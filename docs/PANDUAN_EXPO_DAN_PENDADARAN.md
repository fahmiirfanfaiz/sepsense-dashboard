# Panduan Penguasaan Materi SepSense: Persiapan Capstone Expo & Sidang Pendadaran

Buku panduan ini disusun sebagai referensi belajar komprehensif bagi tim pengembang **SepSense** dalam menghadapi pertanyaan dari pengunjung stan, praktisi industri, dosen pembimbing, maupun dewan penguji pada sidang tugas akhir/pendadaran. Seluruh isi dokumen ini telah diselaraskan 100% dengan implementasi aktual *source code* Web Dashboard, Backend IoT Pipeline, Cloud Deployment, dan AI Microservice.

---

## 📑 Daftar Isi Materi

1. [Master Pitching Guide (Elevator Pitch 30 Detik & 2 Menit)](#1-master-pitching-guide)
2. [Arsitektur Perangkat Lunak & Cloud Deployment End-to-End](#2-arsitektur-perangkat-lunak--cloud-deployment-end-to-end)
3. [Logika Klinis SIRS & Keputusan SpO₂ sebagai Estimasi](#3-logika-klinis-sirs--keputusan-spo₂-sebagai-estimasi)
4. [Teknik Mitigasi Derau Sinyal & Keandalan Sensor IoT (4-Tier Defense)](#4-teknik-mitigasi-derau-sinyal--keandalan-sensor-iot-4-tier-defense)
5. [Mesin AI Machine Learning (FastAPI + XGBoost Microservice)](#5-mesin-ai-machine-learning-fastapi--xgboost-microservice)
6. [Arsitektur Frontend Web Dashboard, Keamanan & Real-Time UX](#6-arsitektur-frontend-web-dashboard-keamanan--real-time-ux)
7. [Bukti Ilmiah Verifikasi & Validasi (V&V), Interpretasi & Research Papers](#7-bukti-ilmiah-verifikasi--validasi-vv-interpretasi--research-papers)
8. [Bank Tanya Jawab Sidang & Expo (Tough Q&A)](#8-bank-tanya-jawab-sidang--expo-tough-qa)

---

## 1. Master Pitching Guide

### A. Elevator Pitch (30 Detik — Untuk Pengunjung Stan)
> *"Halo! Kenalkan, ini **SepSense**, sistem pemantauan ranjang pasien terintegrasi IoT dan AI untuk deteksi dini **sepsis**. Sepsis adalah kondisi darurat medis di mana infeksi memicu kegagalan organ dan keterlambatan deteksi beberapa jam saja bisa berakibat fatal. SepSense membaca denyut jantung, laju pernapasan, suhu tubuh, dan estimasi saturasi oksigen secara nirkabel, menyaring derau sinyal selama jendela 3 menit (18 sampel), lalu menggabungkan aturan klinis baku **SIRS** dan model Machine Learning **XGBoost** untuk mendeteksi perburukan kondisi pasien secara real-time dan membunyikan alarm otomatis sebelum pasien jatuh ke fase syok septik."*

### B. Product & Engineering Pitch (2 Menit — Untuk Juri / Dosen Penguji)
> *"Sepsis menyebabkan jutaan kematian setiap tahun, dan tantangan terbesarnya di rumah sakit adalah pemantauan tanda vital manual di bangsal sering kali dilakukan secara berkala (tiap 4–6 jam), sehingga fase kritis perburukan sering terlewatkan. Di sisi lain, alat pemantau yang terlalu sensitif terhadap gerakan pasien justru memicu **alarm palsu (alarm fatigue)**.*
>
> *SepSense memecahkan kedua masalah tersebut melalui arsitektur **Dual-Engine Bedside Monitoring**:*
> 1. *Perangkat IoT membaca tanda vital pasien dan mengirimkannya secara terenkripsi melalui protokol **MQTT over TLS (Port 8883)** ke cloud broker EMQX.*
> 2. *Backend Node.js menyaring data melalui **Gatekeeper 3 Menit (Buffer 18 Sampel)** dengan **Filter Median** dan **Deteksi Gerakan Sensor** agar artefak sesaat tidak memicu alarm palsu.*
> 3. *Setelah 18 sampel terkumpul, data dievaluasi secara paralel oleh dua mesin:*
>    - ***Rule Engine Deterministik SIRS (Skor 0–3)*** *berdasarkan 3 parameter terkalibrasi (HR, RR, Suhu) untuk kepatuhan baku SOP triase klinis.*
>    - ***Microservice AI FastAPI (XGBoost v2)*** *yang dihubungi oleh backend via **HTTP REST API (`POST /predict/realtime`)**, mengekstraksi **36 fitur time-series & interaksi fisiologis** untuk mengestimasi probabilitas risiko sepsis.*
> 4. *Hasilnya dipancarkan seketika melalui **WebSocket (Socket.IO)** ke Web Dashboard Next.js dan disimpan ke **PostgreSQL Supabase**. Saat skor mencapai ambang kritis ($\text{Skor} \ge 2$), dashboard langsung mengaktifkan sirene audio dan notifikasi darurat."*

---

## 2. Arsitektur Perangkat Lunak & Cloud Deployment End-to-End

### Diagram Alur Komunikasi & Protokol Sistem

```
┌──────────────────────────┐    MQTT over TLS (Port 8883)    ┌────────────────────────────────────────┐
│ Hardware IoT Bedside     ├────────────────────────────────►│ Backend Express 5 (Render Cloud)       │
│ - MAX30102 (HR & SpO2)   │  Broker: EMQX Cloud Serverless  │ - mqttHandler.js (18-Sample Buffer)    │
│ - MPU6050  (Resp Rate)   │  Topic : sepsense/{id}/telemetry│ - 3-Min Median & Motion Artifact Filter│
│ - MLX90614 (Temperature) │                                 │ - Deterministic SIRS Engine (Skor 0-3) │
└──────────────────────────┘                                 └───────┬────────────────────────┬───────┘
                                                                     │                        │
                      ┌──────────────────────────────────────────────┤                        │
                      │ HTTP REST API (JSON)                         │ SQL (PgBouncer 6543)   │ WebSocket (Socket.IO)
                      │ POST /predict/realtime                       ▼                        │ + REST API (/api/dashboard)
                      │ (Current Vitals + 18-Sample Buffer)  ┌───────────────────────┐        ▼
                      ▼                                      │ Supabase PostgreSQL   │ ┌──────────────────────────────────┐
       ┌────────────────────────────────────┐                │ - vital_readings      │ │ Frontend Next.js 16 (Vercel)     │
       │ FastAPI AI Service (Render Cloud)  │                │ - risk_assessments    │ │ - Multi-Bed Overview & CRUD      │
       │ - XGBoost Classifier (xgb-v2)      │                │ - ai_predictions      │ │ - WarmUpCard (18-Sample Progress)│
       │ - 36 Engineered Features (Window)  │                │ - monitoring_sessions │ │ - RiskCard & AiPredictionCard    │
       │ - Clinical Probability Harmonizer  │                │ - patients & devices  │ │ - Recharts Real-Time + Audio     │
       └────────────────────────────────────┘                └───────────────────────┘ └──────────────────────────────────┘
```

### Rincian Infrastruktur & Protokol Komunikasi
1. **Hardware $\rightarrow$ Backend (Protokol: `MQTT over TLS` Port `8883`):**
   - Perangkat mikrokontroler mempublikasikan JSON telemetri ke broker **EMQX Cloud** pada topik `sepsense/{deviceId}/telemetry`.
   - **Penting untuk Sidang:** Model AI **tidak** mengambil data langsung dari perangkat lewat MQTT. Backend Node.js yang menjadi *subscriber* MQTT, memvalidasi dan membuffer 18 sampel, lalu meneruskannya ke AI.
2. **Backend $\rightarrow$ AI Service (Protokol: `HTTP/HTTPS REST API`):**
   - Backend memanggil endpoint `POST /predict/realtime` pada layanan FastAPI (`https://sepsense-ai.onrender.com`) menggunakan `fetch` dengan *timeout guard* 8 detik.
   - Payload yang dikirim mencakup bacaan tanda vital terkini sekaligus array **`recent_readings` (18 sampel terakhir)** agar AI dapat menghitung tren dan standar deviasi.
3. **Backend $\leftrightarrow$ Database (Protokol: `PostgreSQL Wire Protocol via Supabase Pooler`):**
   - Menggunakan *Transaction Pooler* (`Port 6543` dengan `pgbouncer=true`) untuk operasi *insert* telemetri berfrekuensi tinggi, serta *Session Pooler* (`Port 5432`) untuk migrasi skema.
4. **Backend $\leftrightarrow$ Frontend (Protokol: `WebSocket Socket.IO` & `HTTPS REST API`):**
   - Transmisi telemetri *live* menggunakan **Socket.IO** (`sensor:data`, `device:telemetry`, `device:status`, `overview:bed_update`).
   - Operasi manajemen data (Autentikasi, CRUD Ranjang, CRUD Pasien, dan pengambilan riwayat awal) menggunakan **REST API** (`/api/dashboard/...`).
5. **Strategi *Zero Cold-Start* (Cron Job Keep-Alive):**
   - Layanan *free-tier* di Render (`sepsense-backend` & `sepsense-ai`) dijaga tetap aktif 24/7 menggunakan penjadwal otomatis eksternal (**cron-job.org**) yang mengirim `GET /health` setiap 10–14 menit.

---

## 3. Logika Klinis SIRS & Keputusan SpO₂ sebagai Estimasi

### Konsensus Internasional SIRS (*Systemic Inflammatory Response Syndrome*)
SepSense mengacu pada kriteria baku **Bone et al. (ACCP/SCCM Consensus)** untuk parameter tanda vital non-invasif:

| Kriteria | Parameter Fisiologis | Rentang Normal Baku | Ambang Abnormal SIRS | Status di SepSense (`SCORE_SPO2 = false`) |
| :---: | :--- | :---: | :---: | :--- |
| **C1** | Heart Rate (HR) | **60 – 90 bpm** | $< 60$ atau $> 90\text{ bpm}$ | **Aktif Masuk Skor** (Bobot: $+1$) |
| **C2** | Respiratory Rate (RR) | **12 – 20 rpm** | $> 20\text{ rpm}$ | **Aktif Masuk Skor** (Bobot: $+1$) |
| **C3** | Suhu Tubuh (Temp) | **36,0 – 38,0 °C** | $< 36,0^\circ\text{C}$ atau $> 38,0^\circ\text{C}$ | **Aktif Masuk Skor** (Bobot: $+1$) |
| **C4** | $\text{SpO}_2$ (Saturasi Oksigen) | **95,1 – 100 %** | $< 95,1\%$ | **Indikator Estimasi Pendukung** (Bobot: $0$) |

### 💡 Mengapa SpO₂ Diatur Menjadi "Estimasi" (`SCORE_SPO2 = false`)?
> **Pertanyaan Penguji:** *"Mengapa $\text{SpO}_2$ hanya ditampilkan sebagai estimasi dan rentang skor aktifnya menjadi 0–3, bukan 0–4?"*
>
> **Jawaban Terbaik:**
> *"Berdasarkan evaluasi rekayasa klinis pada Firmware v4.5 terhadap sensor fotopletismografi (PPG) reflektif MAX30102, pembacaan $\text{SpO}_2$ sangat sensitif terhadap tekanan kontak jari, pergeseran posisi, dan perfusi perifer. Memasukkan parameter optik yang belum dikalibrasi terhadap Analisis Gas Darah (ABG) ke dalam penentu skor alarm berisiko memicu **alarm palsu (false positive)**.*
>
> *Oleh sebab itu, kami menerapkan prinsip desain perangkat lunak medis yang aman: **nilai $\text{SpO}_2$ tetap ditampilkan pada grafik dengan label `SpO₂ (estimasi)` sebagai informasi pendukung bagi klinisi, namun diisolasi dari kalkulasi skor SIRS (`SCORE_SPO2 = false`)**. Dengan demikian, skor klinis aktif bertumpu pada 3 parameter terkalibrasi (HR, RR, dan Suhu) dengan rentang **Skor 0 hingga 3**. Desain ini bersifat modular—jika di masa depan sensor $\text{SpO}_2$ kelas medis terkalibrasi digunakan, konstanta `SCORE_SPO2` cukup diubah menjadi `true`."*

### Pemetaan Skor SIRS (0–3), Label Klinis UI, dan Enum Database
Di dalam kode backend ([mqttHandler.js](file:///d:/Source%20Code/College/Capstone/server/src/handlers/mqttHandler.js) & [dashboard.service.js](file:///d:/Source%20Code/College/Capstone/server/src/services/dashboard.service.js)), sistem menjaga kompatibilitas antara constraint enum PostgreSQL dan label antarmuka pengguna:

| Skor SIRS | Jumlah Kriteria Abnormal | Label Klinis di Web Dashboard | Nilai Enum di DB (`risk_level`) | Status Alarm & Warna Indikator |
| :---: | :---: | :--- | :---: | :--- |
| **0** | 0 dari 3 | **Stabil** | `AMAN` | 🟢 Normal (Tidak Ada Alarm) |
| **1** | 1 dari 3 | **Perlu Diamati** | `WASPADA` | 🔵 Observasi (Tidak Ada Alarm) |
| **2** | 2 dari 3 | **Waspada** | `RISIKO` | 🟠 **Alert Sepsis Aktif** (Pop-up + Audio) |
| **3** | 3 dari 3 | **Perlu Perhatian** | `RISIKO` | 🔴 **Alert Kritis Prioritas Tinggi** (Pop-up + Audio) |

---

## 4. Teknik Mitigasi Derau Sinyal & Keandalan Sensor IoT (4-Tier Defense)

Untuk mencegah ***Alarm Fatigue*** di ruang rawat, SepSense mengimplementasikan **4 lapis penyaringan sinyal** pada [mqttHandler.js](file:///d:/Source%20Code/College/Capstone/server/src/handlers/mqttHandler.js):

1. **Gatekeeper Warm-Up 3 Menit (Buffer 18 Sampel + *DB Auto-Hydration*):**
   - Sistem wajib mengumpulkan **18 sampel** (interval 10 detik = 3 menit) sebelum membuka kunci penilaian risiko (`WARMUP_SAMPLE_THRESHOLD = 18`).
   - Selama fase ini (`warmingUp: true`), grafik suhu dan tanda vital tetap bergerak secara *live*, namun kartu risiko menampilkan **Progress Bar `X/18 sampel`** dan hitung mundur waktu.
   - **Keunggulan Rekayasa (*DB Hydration*):** Jika server backend baru saja *restart*, sistem otomatis memulihkan sampel dari tabel `vital_readings` yang berusia $< 5$ menit sehingga proses pemantauan tidak perlu mengulang *warm-up* dari 0.
2. **Agregasi Berbasis Median Jendela 3 Menit (*Outlier-Resistant Median*):**
   - Menggunakan nilai tengah (**Median**) dari buffer 18 sampel (`hrMedian`, `respMedian`, `tempMedian`), bukan rata-rata (*mean*). Lonjakan sesaat akibat batuk atau kabel tersentuh tidak akan menggeser nilai median.
3. **Deteksi Status Gerakan Sensor (*BPM Motion Status*):**
   - Mengenali 6 status kualitas sinyal dari firmware: `BAIK`, `MENUNGGU`, `GERAK`, `SINYAL_LEMAH`, `SINYAL_JENUH`, dan `TIDAK_MENEMPEL`.
4. **Proteksi Termal `tempWarm` pada Sensor Inframerah MLX90614:**
   - Saat sensor baru dinyalakan (`tempWarm === false`) dan membaca suhu ruang ($< 36,0^\circ\text{C}$), nilai suhu tetap digambar pada grafik pemantauan untuk transparansi, tetapi **tidak dihitung sebagai hipotermia** pada kriteria C3 SIRS (`tempValForScoring = null`) dan menggunakan *baseline* fisiologis normal ($36,8^\circ\text{C}$) untuk inferensi AI agar tidak memicu alarm hipotermia palsu.

---

## 5. Mesin AI Machine Learning (FastAPI + XGBoost Microservice)

### Spesifikasi Model (`xgb-v2`)
* **Algoritma:** *Extreme Gradient Boosting* (**XGBoost Classifier** — `sepsis_xgb.joblib`).
* **Dataset Referensi:** *PhysioNet / Computing in Cardiology Challenge 2019* (Data klinis pasien ICU).
* **Validasi Silang:** *5-Fold Stratified GroupKFold* berdasarkan `Patient_ID` (mencegah *data leakage* antar-rekaman pasien yang sama).
* **Dimensi Input:** **36 Fitur Rekayasa (*Engineered Features*)** pada [ai/features.py](file:///d:/Source%20Code/College/Capstone/ai/features.py):
  1. **28 Fitur Statistik Time-Series (4 Vital $\times$ 7 Statistik):** Untuk setiap parameter (`HR`, `O2Sat`, `Temp`, `Resp`), diekstraksi nilai *forward-fill* (`_ff`), *rolling mean* (`_m6`), *rolling standard deviation* (`_sd6`), *rolling minimum* (`_min6`), *rolling maximum* (`_max6`), serta tren perubahan *delta lag-3* (`_d3`) dan *delta lag-6* (`_d6`).
  2. **5 Fitur Indikator Klinis SIRS:** `c1_hr`, `c2_rr`, `c3_temp`, `c4_spo2`, dan total kriteria `n_crit`.
  3. **3 Fitur Interaksi Fisiologis Non-Linear:**
     - `shock_index`: Rasio $\text{HR} / \text{Temp}$ (indikator dekompensasi hemodinamik).
     - `hr_resp_prod`: Interaksi kardiorespirasi ($\text{HR} \times \text{Resp}$).
     - `temp_hr_prod`: Interaksi termoregulasi-jantung ($\text{Temp} \times \text{HR}$).

### Harmonisasi Probabilitas Klinis & Visualisasi 3 Tingkat di Dashboard
Pada endpoint `POST /predict/realtime` ([ai/main.py](file:///d:/Source%20Code/College/Capstone/ai/main.py)), probabilitas mentah dari XGBoost (`raw_prob`) diharmonisasikan dengan tingkat keparahan klinis (`clinical_prob`) dan divisualisasikan pada komponen `AiPredictionCard` menjadi 3 kategori:
* **$< 50\%$ (Hijau — Aman):** *"Model tidak mendeteksi risiko sepsis pada sampel bacaan saat ini."*
* **$50\% - 74\%$ (Oranye/Amber — Waspada):** *"Model mendeteksi RISIKO SEPSIS MODERAT — tingkatkan observasi pasien."*
* **$\ge 75\%$ (Merah — Kritis):** *"Model memprediksi RISIKO SEPSIS TINGGI — segera evaluasi kondisi klinis pasien."*

---

## 6. Arsitektur Frontend Web Dashboard, Keamanan & Real-Time UX

### Fitur Utama Web Dashboard ([client/](file:///d:/Source%20Code/College/Capstone/client))
1. **Multi-Bed Overview & Manajemen CRUD Penuh:**
   - Tenaga kesehatan dapat menambahkan ranjang baru (`createBed`), mengubah nama ranjang/kode perangkat/sesi aktif (`updateBed`), menonaktifkan ranjang (`deleteBed`), serta memperbarui atau mereset identitas pasien (`upsertPatient` / `deletePatient`).
   - Setiap perubahan langsung disiarkan via Socket.IO ke seluruh klien yang sedang membuka dashboard tanpa perlu *refresh* halaman.
2. **Sinkronisasi State Real-Time vs Polling Anti-Konflik:**
   - Halaman detail ranjang ([page.js](file:///d:/Source%20Code/College/Capstone/client/src/app/dashboard/%5BdeviceId%5D/page.js)) menggabungkan *streaming* Socket.IO dengan *background polling* tiap 30 detik. State *polling* dirancang *non-destructive* (`data.latestAiPrediction ?? prev?.latestAiPrediction`) sehingga hasil prediksi *live* tidak pernah tertimpa atau hilang.
3. **Auto-Resolver Environment (Localhost & Production Ready):**
   - Pada [api.js](file:///d:/Source%20Code/College/Capstone/client/src/lib/api.js) dan [socket.js](file:///d:/Source%20Code/College/Capstone/client/src/lib/socket.js), fungsi `resolveApiBaseUrl()` dan `resolveSocketUrl()` secara otomatis mendeteksi apakah aplikasi sedang berjalan di `localhost` (mengarahkan ke `http://localhost:5000`) atau di domain produksi Vercel `sepsense.vercel.app` (mengarahkan ke `https://sepsense-backend.onrender.com`).
4. **Keamanan Autentikasi (*Single-Flight Silent Refresh*):**
   - Menggunakan *short-lived* **JWT Access Token** (15 menit) yang dipadukan dengan **Refresh Token Rotation** (7 hari) di dalam cookie `httpOnly`, `Secure`, `SameSite=None`. Jika token akses kedaluwarsa saat dashboard terbuka, *interceptor* `apiFetch` melakukan pembaruan token di latar belakang secara transparan tanpa memutus sesi pemantauan dokter.

---

## 7. Bukti Ilmiah Verifikasi & Validasi (V&V), Interpretasi & Research Papers

### A. Ringkasan Metrik Pengujian Simulasi Monte Carlo ($N = 3.500$ Kasus)
Pengujian dilakukan menggunakan script [ai/validate_system.py](file:///d:/Source%20Code/College/Capstone/ai/validate_system.py) terhadap **$3.500$ sampel uji** yang terdiri dari **$3.200$ sampel kombinasi 16 mode fisiologis ($2^4$)** dengan injeksi derau sensor Gaussian ($\sigma_{\text{HR}} = 1,2\text{ bpm}$, $\sigma_{\text{RR}} = 0,7\text{ rpm}$, $\sigma_{\text{Temp}} = 0,08^\circ\text{C}$) ditambah **$300$ sampel uji ambang batas (*Boundary Value Analysis*)** tepat di titik kritis SIRS:

| Metrik Evaluasi Sistem | Hasil Capaian | Kategori Kinerja Diagnostik | Interpretasi & Makna Klinis |
| :--- | :---: | :---: | :--- |
| **Kesesuaian *Risk Score* (Spesifikasi Multiclass 0–3)** | **95,74%** | **Sangat Baik (*Excellent*)** | Dari $3.500$ sampel berderau, $95,74\%$ terpetakan tepat ke Skor 0, 1, 2, atau 3. Deviasi $4,26\%$ hanya terjadi $\pm 1$ kelas di titik perbatasan tipis; **0% kesalahan ekstrem**. |
| **Akurasi Notifikasi Alarm (Binary Alert $\ge 2$)** | **97,71%** | **Sangat Baik (*Excellent*)** | Keputusan pengaktifan alarm darurat akurat pada $3.420$ dari $3.500$ kasus uji. |
| **Sensitivitas (*Recall*) Alarm** | **97,32% (~97,3%)** | **Sangat Baik (*Excellent*)** | Kemampuan mendeteksi pasien berisiko sepsis ($\text{Skor} \ge 2$) mencapai **97,3%** ($\text{TP} = 1.707$), meminimalkan risiko pasien kritis yang terlewat (*missed diagnosis*). |
| **Spesifisitas Alarm** | **98,11% (~98,1%)** | **Sangat Baik (*Excellent*)** | Kemampuan menahan alarm pada pasien stabil/aman mencapai **98,1%** ($\text{TN} = 1.713$), menekan *False Alarm Rate* hingga hanya **$1,9\%$** untuk mencegah *alarm fatigue*. |
| **Presisi Alarm & F1-Score** | **98,10% / 0,9771** | **Sangat Baik (*Excellent*)** | Keseimbangan harmonis antara ketepatan peringatan dan cakupan deteksi sepsis. |

### B. Dasar Skala Kategori Diagnostik ("Sangat Baik / *Excellent*")
Dalam biostatistika medis dan evaluasi sistem kecerdasan buatan klinis, pengkategorian nilai akurasi, sensitivitas, dan spesifisitas mengacu pada skala baku internasional:
* **90% – 100%:** **Sangat Baik / Istimewa (*Excellent / Outstanding*)** — Layak untuk sistem peringatan dini kritis.
* **80% – 89%:** **Baik (*Good / Acceptable*)** — Layak untuk *screening* awal dengan pengawasan.
* **70% – 79%:** **Cukup (*Fair / Moderate*)** — Membutuhkan kalibrasi lebih lanjut.
* **$< 70\%$:** **Kurang (*Poor*)** — Tidak layak untuk penggunaan klinis.

Karena seluruh capaian SepSense berada di rentang **95,74% – 98,11%**, sistem ini secara mutlak berada pada kategori tertinggi (**Sangat Baik / *Excellent***) dengan indeks diagnostik **Youden's Index ($J = \text{Sensitivitas} + \text{Spesifisitas} - 1$) sebesar $0,954$** (mendekati nilai sempurna $1,0$).

### C. Daftar Rujukan Ilmiah (*Research Papers*) Pendukung Sidang
1. **Dasar Kategori Nilai Diagnostik $> 90\% = \text{Excellent / Outstanding}$:**
   - **Mandrekar, J. N. (2010).** *"Receiver Operating Characteristic Curve in Diagnostic Test Assessment."* **Journal of Thoracic Oncology**, 5(9), 1315–1316.
   - **Hosmer, D. W., & Lemeshow, S. (2000).** *"Applied Logistic Regression"* (2nd ed.). John Wiley & Sons. *(Menetapkan standar baku bahwa nilai evaluasi diagnostik $0,80–0,90$ adalah Excellent dan $> 0,90$ adalah Outstanding/Sangat Baik).*
2. **Dasar Interpretasi Sensitivitas & Spesifisitas pada Alat *Screening* Medis:**
   - **Trevethan, R. (2017).** *"Sensitivity, Specificity, and Predictive Values: Foundations, Pliabilities, and Pitfalls in Research and Practice."* **Frontiers in Public Health**, 5, 307.
   - **Fleuren, L. M., et al. (2020).** *"Machine learning for the prediction of sepsis: a systematic review and meta-analysis of diagnostic test accuracy."* **Intensive Care Medicine**, 46(3), 383–400.
3. **Dasar Dataset & Pemodelan AI XGBoost untuk Deteksi Sepsis:**
   - **Reyna, M. A., et al. (2020).** *"Early Prediction of Sepsis from Clinical Data: The PhysioNet/Computing in Cardiology Challenge 2019."* **Critical Care Medicine**, 48(2), 210–217.
   - **Zabihi, M., et al. (2019).** *"Sepsis Prediction in Intensive Care Unit Using Ensemble of XGboost Models."* **Computing in Cardiology (CinC)**, IEEE.
4. **Dasar Kriteria Medis SIRS & Mitigasi *Alarm Fatigue*:**
   - **Bone, R. C., et al. (1992).** *"Definitions for Sepsis and Organ Failure and Guidelines for the Use of Innovative Therapies in Sepsis."* **Chest**, 101(6), 1644–1655.
   - **Cvach, M. (2012).** *"Monitor Alarm Fatigue: An Integrative Review."* **Biomedical Instrumentation & Technology**, 46(4), 268–277.

---

## 8. Bank Tanya Jawab Sidang & Expo (Tough Q&A)

### Q1: "Dari mana model AI menerima data bacaan sensor? Apakah langsung dari hardware lewat MQTT atau dari backend?"
> **Jawaban:**  
> *"Model AI **tidak** menerima data langsung dari hardware melalui MQTT, melainkan menerima data yang sudah dibersihkan dan dibuffer dari **Backend Node.js** melalui protokol komunikasi **HTTP/HTTPS REST API** (`POST /predict/realtime` dengan format JSON). Alurnya: Hardware mengirim data ke broker EMQX via **MQTT over TLS (Port 8883)** $\rightarrow$ Backend Node.js mengumpulkan 18 sampel (3 menit) dan menghitung median $\rightarrow$ Backend memanggil microservice FastAPI AI via **HTTP POST** $\rightarrow$ Hasil prediksi AI disimpan ke PostgreSQL Supabase dan dikirim ke Web Dashboard via **WebSocket (Socket.IO)**."*

### Q2: "Apa perbedaan mendasar antara Skor SIRS dan Hasil Prediksi AI? Kenapa harus ada dua-duanya?"
> **Jawaban:**  
> *"Keduanya berperan sebagai **Dual-Defense Clinical Decision Support**:*
> * ***Skor SIRS (0–3)*** *adalah evaluasi **deterministik berbasis aturan klinis baku**. Tujuannya adalah transparansi medis dan kepatuhan terhadap SOP rumah sakit—dokter dapat melihat kriteria mana yang abnormal (HR, RR, atau Suhu).*
> * ***Model AI XGBoost*** *adalah **analisis prediktif multivariat non-linear**. AI mengevaluasi 36 fitur sekaligus—termasuk tren perubahan (delta), standar deviasi (ketidakstabilan), dan rasio interaksi seperti Shock Index ($\text{HR}/\text{Temp}$)—sehingga mampu memberikan estimasi probabilitas risiko secara kontinu."*

### Q3: "Bagaimana jika microservice AI sedang *cold-start* atau mati mendadak saat pasien sedang dipantau?"
> **Jawaban:**  
> *"Kami merancang sistem dengan dua lapis pengaman:*
> 1. ***Preventif (Keep-Alive Cron Job):*** *Kami mengonfigurasi cron job otomatis yang melakukan ping ke endpoint `/health` pada Backend dan AI Service setiap 10–14 menit sehingga container di Render tidak pernah tertidur (zero cold-start).*
> 2. ***Reaktif (Deterministic Clinical Fallback):*** *Di dalam `mqttHandler.js`, panggilan HTTP ke AI memiliki batas waktu (timeout) 8 detik dan blok fallback deterministik. Jika layanan AI tidak dapat dijangkau, backend tetap menghitung Skor SIRS 0–3, tetap membunyikan alarm jika $\text{Skor} \ge 2$, dan menyuplai estimasi probabilitas fallback berbasis profil klinis SIRS sehingga dashboard tidak pernah menampilkan halaman kosong atau gagal menyimpan data."*

### Q4: "Mengapa pada Confusion Matrix Risk Score terdapat sel di luar diagonal utama sebesar 4,26% (akurasi 95,74%), bukan 100%?"
> **Jawaban:**  
> *"Karena pengujian kami menyertakan **Simulasi Monte Carlo dengan derau sensor Gaussian riil** ($\pm 1,2\text{ bpm}$ pada HR, $\pm 0,7\text{ rpm}$ pada RR, dan $\pm 0,08^\circ\text{C}$ pada Suhu) serta **300 kasus uji tepat di garis ambang batas (Boundary Value Analysis)**—misalnya suhu pasien $37,96^\circ\text{C}$ yang berada sangat dekat dengan batas demam $38,0^\circ\text{C}$. Ketika terkena derau sensor $+0,08^\circ\text{C}$, suhu terukur menjadi $38,04^\circ\text{C}$ sehingga skor bergeser 1 tingkat ke kelas tetangga. Justru hal ini membuktikan bahwa pengujian validasi kami mencerminkan kondisi fisik sensor di dunia nyata, dan yang terpenting: **0% kesalahan melompat lebih dari 1 tingkat skor**."*

### Q5: "Bagaimana cara mendemonstrasikan sistem ini secara instan saat Expo atau Sidang?"
> **Jawaban:**  
> *"Selain menggunakan perangkat fisik (`sepsense-01`), kami menyediakan simulator telemetri ([server/scripts/simulate.js](file:///d:/Source%20Code/College/Capstone/server/scripts/simulate.js)) dan endpoint simulasi (`/api/simulate-telemetry`) yang mendukung seluruh 16 mode kombinasi tanda vital SIRS. Penguji dapat melihat secara langsung transisi dari fase pengumpulan 18 sampel (Warm-Up) hingga munculnya klasifikasi AI, perubahan warna indikator ranjang, dan berbunyinya sirene peringatan darurat."*

---

*Dokumen ini disusun dan diperbarui sesuai implementasi produksi Capstone SepSense 2026.*
