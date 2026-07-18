# Обучение модели

Генерация датасета и обучение компактной нейросети, предсказывающей параметры коррекции изображения
(brightness, contrast, saturation).

## Пайплайн

```
DIV2K (качественные фото)
        │
        ▼
create_data.ipynb  ──►  синтетически деградированные изображения + targets.json
        │
        ▼
model_training.ipynb  ──►  best_model.pt → model_int8.onnx → weights.json
```

## 1. Исходный датасет

Используется **DIV2K** (800 train + 100 validation изображений, высокое качество,
разнообразные сюжеты): https://www.kaggle.com/datasets/soumikrakshit/div2k-high-resolution-images

## 2. Генерация синтетического датасета

```bash
pip install opencv-python numpy tqdm
python generate_dataset.py
```

Что делает скрипт:
- Разбивает исходные изображения на train/val/test (80/10/10) **до** генерации
  вариантов — чтобы избежать утечки данных между сплитами
- Синтетически "портит" каждый кроп по brightness, contrast, saturation
- Аналитически считает обратные параметры коррекции 
- Сохраняет результат в data/synthetic/{train,val,test}/degraded/*.jpg +
  argets.json с полями brightness, contrast, saturation

Готовый датасет также опубликован как приватный Kaggle Dataset:
https://www.kaggle.com/datasets/olesya25/synthetic-images

## 3. Обучение модели

Откройте model_training.ipynb в Kaggle или Google Colab (нужен GPU — T4
достаточно с большим запасом).

Ноутбук содержит:
1. Датасет EnhanceDataset - загрузка degraded-изображений и targets,
   конвертация contrast/saturation в лог-пространство
2. Модель TinyEnhanceNet - компактная CNN, около 190K параметров
3. Проверка диапазонов целевых значений (важно для калибровки выходного слоя)
4. Обучение - взвешенный Huber loss, ReduceLROnPlateau, early stopping
5. Экспорт в ONNX + квантизация (int8)
6. Быстрая проверка на одном изображении
7. Полная оценка качества на тестовой выборке (PSNR, MAE по каналам)
8. Диагностика худших примеров
9. Экспорт весов в weights.json для inference в браузере
