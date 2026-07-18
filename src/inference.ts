//Минимальный ручной forward pass для TinyEnhanceNet 

export interface ConvBlockWeights {
  weight: number[]; // flat [cout, cin, k, k]
  bias: number[];   // [cout]
  cout: number;
  cin: number;
  k: number;
  stride: number;
}

export interface LinearWeights {
  weight: number[]; // flat [out, in]
  bias: number[];   // [out]
  in: number;
  out: number;
}

export interface ModelWeights {
  blocks: ConvBlockWeights[];
  fc1: LinearWeights;
  fc2: LinearWeights;
}

/** Тензор как из Pytorch */
interface Tensor {
  data: Float32Array;
  c: number;
  h: number;
  w: number;
}

function conv2dReluBias(input: Tensor, block: ConvBlockWeights): Tensor {
  const { weight, bias, cout, cin, k, stride } = block;
  const pad = 1;
  const outH = Math.floor((input.h + 2 * pad - k) / stride) + 1;
  const outW = Math.floor((input.w + 2 * pad - k) / stride) + 1;

  const out = new Float32Array(cout * outH * outW);
  const W = weight;
  const inData = input.data;

  for (let oc = 0; oc < cout; oc++) {
    const b = bias[oc];
    const wBase = oc * cin * k * k;
    for (let oy = 0; oy < outH; oy++) {
      for (let ox = 0; ox < outW; ox++) {
        let sum = b;
        const inYStart = oy * stride - pad;
        const inXStart = ox * stride - pad;

        for (let ic = 0; ic < cin; ic++) {
          const inChBase = ic * input.h * input.w;
          const wChBase = wBase + ic * k * k;
          for (let ky = 0; ky < k; ky++) {
            const iy = inYStart + ky;
            if (iy < 0 || iy >= input.h) continue;
            const inRowBase = inChBase + iy * input.w;
            const wRowBase = wChBase + ky * k;
            for (let kx = 0; kx < k; kx++) {
              const ix = inXStart + kx;
              if (ix < 0 || ix >= input.w) continue;
              sum += inData[inRowBase + ix] * W[wRowBase + kx];
            }
          }
        }
        out[oc * outH * outW + oy * outW + ox] = sum > 0 ? sum : 0;
      }
    }
  }

  return { data: out, c: cout, h: outH, w: outW };
}

function globalAvgPool(input: Tensor): Float32Array {
  const result = new Float32Array(input.c);
  const hw = input.h * input.w;
  for (let c = 0; c < input.c; c++) {
    let sum = 0;
    const base = c * hw;
    for (let i = 0; i < hw; i++) sum += input.data[base + i];
    result[c] = sum / hw;
  }
  return result;
}

function linear(input: Float32Array, layer: LinearWeights, relu: boolean): Float32Array {
  const { weight, bias, in: inF, out: outF } = layer;
  const result = new Float32Array(outF);
  for (let o = 0; o < outF; o++) {
    let sum = bias[o];
    const base = o * inF;
    for (let i = 0; i < inF; i++) sum += input[i] * weight[base + i];
    result[o] = relu ? (sum > 0 ? sum : 0) : sum;
  }
  return result;
}

// Прогоняет изображение через сеть и возвращает (brightness, contrast, saturation) 
export function runForward(
  inputCHW: Float32Array,
  weights: ModelWeights,
  size = 224
): [number, number, number] {
  let x: Tensor = { data: inputCHW, c: 3, h: size, w: size };

  for (const block of weights.blocks) {
    x = conv2dReluBias(x, block);
  }

  const pooled = globalAvgPool(x); // [128]
  const h1 = linear(pooled, weights.fc1, true);
  const h2 = linear(h1, weights.fc2, false);

  const brightness = Math.tanh(h2[0]) * 3.0;
  const logContrast = Math.tanh(h2[1]) * 2.5;
  const logSaturation = Math.tanh(h2[2]) * 3.3;

  const contrast = Math.exp(logContrast);
  const saturation = Math.exp(logSaturation);

  return [brightness, contrast, saturation];
}
