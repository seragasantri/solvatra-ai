# AI & Data Scientist Knowledge Base (Solvatra)
Disuling dari roadmap.sh/ai-data-scientist. Pedoman praktis: matematika, statistik, A/B testing, ekonometrika/time series, Python, SQL, EDA, machine learning, deep learning, MLOps, AI engineering, dan tools.

## Mathematics
- Aljabar linear: vektor/matriks, dot product, eigen, dekomposisi — dasar ML/DL.
- Kalkulus: turunan/gradien (dasar gradient descent & backprop), aturan rantai.
- Optimasi: fungsi cost, minima/maxima, gradient descent (batch/SGD/mini-batch), learning rate.

## Statistics
- Deskriptif: mean/median/mode, varians/std, distribusi, skewness, korelasi vs kausalitas.
- Distribusi: normal, binomial, Poisson; Central Limit Theorem (CLT) → dasar inferensi.
- Inferensi: estimasi, confidence interval, sampling & bias.
- Hypothesis testing: null vs alternatif, p-value, alpha, error Tipe I/II, power, uji t/chi-square/ANOVA.

## A/B Testing
- Rancang eksperimen: hipotesis jelas, metrik utama (guardrail juga), unit acak, ukuran sampel (power analysis, Minimum Detectable Effect).
- Analisis: uji signifikansi, hindari peeking/multiple comparisons, praktikkan randomisasi & kontrol.
- Sensitivitas: CUPED/stratifikasi untuk kurangi varians; ratio metrics pakai Delta Method.
- Waspada: novelty effect, seasonality, Simpson's paradox, sample ratio mismatch.

## Econometrics & Time Series
- Regresi (OLS): asumsi (linearitas, homoskedastisitas, no multikolinearitas, residual normal), interpretasi koefisien, R²/adjusted.
- Time series: tren/musiman/stasioneritas, differencing, ACF/PACF, model ARIMA/SARIMA, backtesting, hindari data leakage (split kronologis).

## Python
- Pilar data: numpy (array/vektorisasi), pandas (DataFrame: filter, groupby, merge, pivot), matplotlib/seaborn (plot).
- DSA secukupnya: kompleksitas Big-O, struktur (list/dict/set), problem solving.
- Praktik: fungsi kecil, vektorisasi (hindari loop lambat), virtualenv, requirements/lockfile, notebook untuk eksplor + skrip/modul untuk produksi.

## SQL
- Query: SELECT/WHERE/GROUP BY/HAVING/ORDER BY, JOIN (inner/left/right/full), subquery/CTE, window functions (ROW_NUMBER, RANK, SUM OVER).
- Untuk analitik: agregasi, cohort, funnel; indeks & baca query plan untuk performa. Selalu prepared/parameter (anti-injeksi).

## Exploratory Data Analysis
- Pahami data: tipe kolom, distribusi, missing values, outlier, duplikat, kardinalitas.
- Bersihkan: imputasi (mean/median/model), encoding kategori (one-hot/target), scaling (standard/minmax), tangani skew (log).
- Visualisasi: histogram/box (distribusi), scatter/heatmap korelasi, bar/line (tren). Rumuskan hipotesis dari temuan.

## Machine Learning
- Supervised: regresi (linear, ridge/lasso), klasifikasi (logistic, SVM, kNN, tree, random forest, gradient boosting/XGBoost/LightGBM).
- Unsupervised: clustering (k-means, DBSCAN, hierarchical), dimensionality reduction (PCA, t-SNE/UMAP).
- Workflow: train/val/test split (atau CV), cegah leakage, feature engineering, tuning hyperparameter (grid/random/bayesian).
- Evaluasi: klasifikasi (accuracy, precision/recall, F1, ROC-AUC, confusion matrix), regresi (MAE, RMSE, R²). Perhatikan bias-variance, over/underfitting, class imbalance (resample/kelas bobot).

## Deep Learning
- Jaringan: fully-connected (MLP), CNN (citra), RNN/LSTM/GRU (urutan), Transformer & attention (NLP/LLM modern).
- Latihan: fungsi aktivasi (ReLU/GELU), loss (cross-entropy/MSE), optimizer (Adam), regularisasi (dropout, weight decay, batchnorm), learning-rate schedule, early stopping.
- Transfer learning & fine-tuning model pra-latih; augmentasi data; pakai GPU. Framework: PyTorch / TensorFlow.

## MLOps
- Reprodusibilitas: versioning data & model (DVC/MLflow), pipeline (training→eval→registry).
- Deployment: batch vs real-time (REST/gRPC), containerisasi (Docker), CI/CD untuk model.
- Monitoring produksi: drift data/konsep, kualitas prediksi, latency/biaya, retraining terjadwal.

## AI Engineering
- LLM & prompt engineering, RAG (retrieval + generation), AI agents (tool use), fine-tuning vs prompting.
- Embeddings & vector DB untuk semantic search/RAG; evaluasi & observability (tracing, eval set).
- (Solvatra sendiri contoh AI agent: memory, tools, RAG-lite, MCP, eval — lihat kemampuannya.)

## Tools & Libraries
- Analisis: pandas, numpy, scipy, statsmodels. Viz: matplotlib, seaborn, plotly.
- ML: scikit-learn, XGBoost/LightGBM/CatBoost. DL: PyTorch, TensorFlow/Keras, Hugging Face.
- Ops/eksperimen: Jupyter, MLflow, DVC, Docker; NLP/LLM: Hugging Face, LangChain/LlamaIndex.
