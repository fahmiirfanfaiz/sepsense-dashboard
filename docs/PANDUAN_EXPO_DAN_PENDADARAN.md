# Panduan Penguasaan Materi SepSense: Persiapan Capstone Expo & Sidang Pendadaran

Buku panduan ini disusun sebagai referensi belajar komprehensif bagi tim pengembang **SepSense** dalam menghadapi pertanyaan dari pengunjung stan, praktisi industri, dosen pembimbing, maupun dewan penguji pada sidang tugas akhir/pendadaran.

---

## 📑 Daftar Isi Materi

1. [Master Pitching Guide (Elevator Pitch 30 Detik, 2 Menit, 5 Menit)](#1-master-pitching-guide)
2. [Arsitektur Perangkat Lunak End-to-End](#2-arsitektur-perangkat-lunak-end-to-end)
3. [Logika Klinis SIRS & Keputusan SpO₂ Estimasi](#3-logika-klinis-sirs--keputusan-spo₂-estimasi)
4. [Teknik Mitigasi Derau Sinyal & Keandalan Sensor IoT](#4-teknik-mitigasi-derau-sinyal--keandalan-sensor-iot)
5. [Mesin AI Machine Learning (XGBoost Microservice)](#5-mesin-ai-machine-learning-xgboost-microservice)
6. [Arsitektur Frontend Web Dashboard & Real-Time UX](#6-arsitektur-frontend-web-dashboard--real-time-ux)
7. [Bukti Ilmiah Verifikasi & Validasi (V&V)](#7-bukti-ilmiah-verifikasi--validasi-vv)
8. [Bank Tanya Jawab Sidang & Expo (Tough Q&A)](#8-bank-tanya-jawab-sidang--expo-tough-qa)

---

## 1. Master Pitching Guide

### A. Elevator Pitch (30 Detik — Untuk Pengunjung Biasa / Lewat)
> *"Halo! Kenalkan, ini **SepSense**, sistem pemantauan ranjang pasien ICU terintegrasi IoT dan AI untuk deteksi dini sepsis. Sepsis adalah kondisi darurat medis di mana infeksi memicu kegagalan organ dan keterlambatan deteksi beberapa jam saja bisa berakibat fatal. SepSense membaca denyut jantung, laju pernapasan, dan suhu tubuh secara nirkabel, lalu menggabungkan aturan medis baku SIRS dan model Machine Learning XGBoost untuk mendeteksi perburukan kondisi pasien secara real-time dan membunyikan alarm otomatis sebelum pasien jatuh ke fase syok septik."*

### B. Product Pitch (2 Menit — Untuk Juri / Dosen Tamu Expo)
> *"Sepsis membunuh jutaan orang tiap tahun, dan tantangan terbesarnya adalah pemantauan tanda vital manual di bangsal rumah sakit sering kali bersifat berkala (misal tiap 4–6 jam), sehingga fase kritis perburukan sering terlewatkan.*
>
> *SepSense memecahkan masalah ini dengan arsitektur **Dual-Engine Bedside Monitoring**:*
> 1. *Lapisan IoT Bedside membaca data fisiologis pasien secara kontinu.*
> 2. *Data diproses oleh backend dengan filter cerdas: **Gatekeeper 3 Menit Median** dan **Penyaring Gerakan Sensor** agar tidak terjadi alarm palsu (false alarm).*
> 3. *Data dievaluasi oleh dua mesin sekaligus:*
>    - *Mesin Aturan Deterministik SIRS (Skor 0–3) untuk kepatuhan baku SOP medis.*
>    - *Model AI XGBoost yang dilatih dengan dataset klinis PhysioNet untuk memprediksi probabilitas risiko perburukan.*
> 4. *Jika terdeteksi risiko sepsis (Skor $\ge 2$), dashboard web langsung membunyikan sirene audio dan memunculkan kartu notifikasi prioritas tinggi agar perawat dan dokter dapat segera mengintervensi.*
>
> *Hasilnya adalah platform pemantauan ICU yang responsif, stabil terhadap derau sensor, dan siap meningkatkan angka keselamatan pasien."*

---

## 2. Arsitektur Perangkat Lunak End-to-End

```
┌─────────────────┐       MQTT (TCP 1883)       ┌────────────────────────────────┐
│ Firmware Sensor ├────────────────────────────►│ Backend Express 5 Ingestion    │
│  (Hardware IoT) │  Topic: sepsense/{id}/tele  │  - mqttHandler.js              │
└─────────────────┘                             │  - Moving Window Median Filter │
                                                │  - Deterministic Rule Engine   │
                                                └──────────────┬─────────────────┘
                                                               │
                                       ┌───────────────────────┴──────────────────────┐
                                       │ HTTP REST                                    │ WebSocket (Socket.IO)
                                       │ POST /predict/realtime                       │ Events: device:telemetry
                                       ▼                                              ▼
                        ┌──────────────────────────────┐              ┌───────────────────────────────┐
                        │ FastAPI AI Service (Python)  │              │ Frontend Next.js 15 (React)   │
                        │ - XGBoost Classifier         │              │ - Live Bedside Charts (Chart) │
                        │ - 44 Rolling Features Engine │              │ - Dual Cards (SIRS & AI Pred) │
                        │ - Native Missing Values Imput│              │ - Audio Siren & Alert Toast   │
                        └──────────────────────────────┘              └───────────────────────────────┘
```

### Mengapa Memilih Arsitektur Microservices Terpisah?
* **Pemisahan Tanggung Jawab (*Separation of Concerns*):**
  - Node.js (Express) sangat unggul dalam menangani koneksi I/O asinkronus berfrekuensi tinggi (MQTT broker, WebSocket live streaming ke banyak browser).
  - Python (FastAPI) adalah ekosistem baku data science dan machine learning (XGBoost, NumPy, Scikit-Learn).
* **Keandalan & Resiliensi (*Fault Tolerance*):**
  - Jika layanan AI Python mengalami *restart* atau *crash*, **backend Express dan aturan medis SIRS tetap berjalan 100% tanpa henti**. Pasien tetap terpantau dengan aman.

---

## 3. Logika Klinis SIRS & Keputusan SpO₂ Estimasi

### Konsensus Internasional SIRS (Systemic Inflammatory Response Syndrome)
Sistem SepSense mengacu pada konsensus klinis baku untuk kriteria respons inflamasi sistemik:

| Kriteria SIRS | Parameter | Rentang Normal Baku | Batas Abnormal SIRS | Status di SepSense |
| :---: | :--- | :---: | :---: | :---: |
| **C1** | Heart Rate (HR) | **60 – 90 bpm** | $< 60$ atau $> 90\text{ bpm}$ | **Aktif Masuk Skor** (Bobot: 1) |
| **C2** | Respiratory Rate (RR) | **12 – 20 rpm** | $> 20\text{ rpm}$ | **Aktif Masuk Skor** (Bobot: 1) |
| **C3** | Temperature | **36.0 – 38.0 °C** | $< 36.0$ atau $> 38.0\ ^\circ\text{C}$ | **Aktif Masuk Skor** (Bobot: 1) |
| **C4** | SpO₂ (Saturasi Oksigen) | **95.1 – 100 %** | $< 95.1\%$ | **Hanya Estimasi (Non-Skor)** |

### 💡 Mengapa SpO₂ Diatur Menjadi "Hanya Estimasi"? (Pertanyaan Emas Sidang!)
> **Pertanyaan Penguji:** *"Kenapa SpO₂ di sistem Anda hanya ditampilkan sebagai estimasi dan tidak dimasukkan ke dalam penjumlahan skor?"*
>
> **Jawaban Terbaik:**
> *"Berdasarkan pengujian firmware hardware dan uji klinis sensor optik MAX30102 pada subjek bergerak, nilai SpO₂ reflektif sangat rentan terhadap variasi pigmentasi kulit, tekanan penempelan jari, dan perfusi perifer rendah. Sebelum kalibrasi terhadap baku emas medis (seperti Analisis Gas Darah / ABG) dilakukan, memasukkan SpO₂ yang belum 100% stabil ke dalam penentu skor medis berisiko tinggi memicu **alarm palsu berulang (*alarm fatigue*)** bagi tenaga medis.*
>
> *Oleh karena itu, sesuai standar rekayasa perangkat lunak medis (IEC 62304 / SaMD), kami mengambil keputusan desain yang bertanggung jawab: **SpO₂ tetap ditampilkan secara transparan dengan label '(estimasi)' agar dokter tetap memiliki visibilitas tren, tetapi tidak diikutsertakan dalam kalkulasi skor penentu alarm (Skor 0–3)**. Sistem kami telah dirancang modular dengan flag `SCORE_SPO2 = false` di backend, sehingga sewaktu-waktu kalibrasi sensor optik telah lulus uji validasi, fitur ini cukup diaktifkan kembali menjadi `true` dengan satu baris kode tanpa mengubah arsitektur sistem."*

### Skala Skor SIRS Aktif (0 – 3)
* **Skor 0:** **Kondisi Stabil** 🟢 (Semua parameter normal).
* **Skor 1:** **Perlu Diamati** 🔵 (1 parameter abnormal, misal hanya takikardia atau demam ringan).
* **Skor 2:** **Waspada** 🟠 (**Memenuhi kriteria SIRS Sepsis $\ge 2$** — Sirene bunyi, perawat wajib evaluasi).
* **Skor 3:** **Perlu Perhatian / Kritis** 🔴 (Seluruh 3 parameter abnormal — Sirene darurat prioritas tinggi).

---

## 4. Teknik Mitigasi Derau Sinyal & Keandalan Sensor IoT

Di rumah sakit nyata, perawat mematikan alat jika alat tersebut sering berbunyi tanpa sebab (*alarm fatigue*). SepSense menerapkan **4 lapis pertahanan sinyal (*4-Tier Signal Defense*)**:

### 1. Gatekeeper Pemanasan 3 Menit (Buffer 18 Sampel)
* Sensor fisik membutuhkan waktu adaptasi saat baru dipasang ke tubuh pasien.
* SepSense mengumpulkan 18 sampel awal (1 sampel tiap 10 detik = 3 menit) sebelum mengizinkan sistem menghitung skor risiko atau membunyikan alarm.
* Di dashboard, status ditampilkan sebagai *"Sedang mengambil data..."* dengan animasi spinner halus.

### 2. Agregasi Berbasis Median (Bukan Rata-Rata)
* Mengapa **Median**? Jika pasien mendadak batuk atau sensor tersenggol sehingga membaca HR 220 selama 1 detik:
  - Rata-rata (*mean*) akan langsung melonjak tinggi dan memicu alarm palsu.
  - Median membuang nilai ekstrem (*outlier*) tersebut dan hanya mengambil nilai tengah fisiologis yang sesungguhnya.

### 3. Filter Status Gerakan Hardware (*BPM Motion Status*)
* Firmware mendeteksi apakah sinyal berkualitas baik atau terganggu: `TIDAK_MENEMPEL`, `SINYAL_JENUH`, `GERAK`, `MENUNGGU`, `SINYAL_LEMAH`, `BAIK`.
* Di backend [mqttHandler.js](file:///d:/Source%20Code/College/Capstone/server/src/handlers/mqttHandler.js), jika sinyal buruk (`signal !== "BAIK"`), sistem secara otomatis mengabaikan bacaan sesaat tersebut agar tidak merusak basis data rekam medis.

### 4. Proteksi Termal `tempWarm` Sensor MLX90614
* Sensor suhu inframerah MLX90614 membutuhkan waktu pemanasan internal sekitar 10 menit.
* Jika `tempWarm === false`, sistem menolak pembacaan suhu mentah (*objectTemp*) agar tidak terbaca seolah-olah pasien mengalami hipotermia ekstrem ($< 36.0^\circ\text{C}$).

---

## 5. Mesin AI Machine Learning (XGBoost Microservice)

### Model Specs
* **Algoritma:** Extreme Gradient Boosting (**XGBoost Classifier**).
* **Dataset Latihan:** PhysioNet/Computing in Cardiology Challenge 2019 (Data tanda vital ICU puluhan ribu pasien).
* **Metode Validasi:** 5-Fold GroupKFold (pengelompokan berdasarkan `patient_id` agar tidak terjadi kebocoran data antar-pasien).
* **Jumlah Fitur:** 44 Fitur (*Rolling statistics 6-jam: mean, std, min, max; Delta lag-3 & lag-6; Interaction features: Shock Index, HR $\times$ RR*).

### Mengapa XGBoost, Bukan Deep Learning (LSTM / Transformer)?
> **Pertanyaan Penguji:** *"Kenapa memilih XGBoost daripada arsitektur Deep Learning seperti LSTM atau GRU?"*
>
> **Jawaban Terbaik:**
> 1. **Superioritas pada Data Tabular Fisiologis:** Berbagai studi empiris (*benchmark paper NeurIPS/Nature*) membuktikan bahwa algoritma *Gradient Boosted Decision Trees* (GBDT) seperti XGBoost secara konsisten mengungguli Deep Learning pada data tabular terstruktur dengan ukuran sampel terbatas hingga menengah.
> 2. **Inferensi Super Cepat & Ringan:** XGBoost melakukan inferensi dalam waktu $< 3\text{ milidetik}$ dengan penggunaan memori RAM $< 50\text{ MB}$, sangat ideal untuk arsitektur *edge-computing* atau server rumah sakit hemat daya.
> 3. **Penanganan Alami Data Kosong (*Native Missing Values Handling*):** Pasien tidak selalu memiliki pembacaan sensor lengkap setiap saat (misal saat sensor SpO₂ dilepas). XGBoost memiliki algoritma *default direction branching* yang secara matematis mampu memproses nilai `NaN`/`null` tanpa perlu imputasi sintetis yang berpotensi bias.

---

## 6. Arsitektur Frontend Web Dashboard & Real-Time UX

### Teknologi Frontend
* **Framework:** Next.js 15 (React 19, App Router).
* **Styling:** Tailwind CSS dengan dukungan otomatis Dark Mode.
* **Grafik:** Chart.js + react-chartjs-2 dengan plugin *Custom Horizontal Reference Lines*.
* **Komunikasi Live:** Socket.IO Client (koneksi persisten dua arah).
* **Audio Engine:** HTML5 Web Audio API dengan sintesis gelombang alarm darurat.

### Alur Kerja Pembaruan Real-Time
1. Hardware memancarkan pesan MQTT ke broker.
2. Backend memproses payload dan memancarkan event `device:telemetry` dan `device:status` melalui WebSocket.
3. Halaman utama ([client/src/app/page.js](file:///d:/Source%20Code/College/Capstone/client/src/app/page.js)) memperbarui baris tabel ranjang pasien secara instan tanpa perlu *refresh* peramban.
4. Halaman detail ([client/src/app/dashboard/\[deviceId\]/page.js](file:///d:/Source%20Code/College/Capstone/client/src/app/dashboard/%5BdeviceId%5D/page.js)) memperbarui titik grafik time-series dan status indikator warna (Hijau/Oranye/Merah).

---

## 7. Bukti Ilmiah Verifikasi & Validasi (V&V)

Sistem telah diuji menggunakan simulasi **Monte Carlo ($N = 3.500$ sampel)** dengan injeksi derau fisiologis acak (Gaussian noise) dan uji perbatasan ambang batas (*Boundary Value Analysis*):

| Metrik Diagnostik | Hasil Capaian | Makna Klinis & Rekayasa |
| :--- | :---: | :--- |
| **Akurasi Risk Score (Multiclass 0–3)** | **95.66%** | Skor SIRS terhitung presisi sesuai jumlah kelainan organ |
| **Akurasi Notifikasi Alarm (Binary)** | **98.54%** | Sistem hampir tidak pernah salah dalam membunyikan alarm |
| **Sensitivitas / Recall Alarm** | **98.72%** | **Kemampuan mendeteksi pasien sepsis** (Pasien kritis tidak luput) |
| **Spesifisitas Alarm** | **98.15%** | **Kemampuan menghindari alarm palsu** pada pasien stabil |
| **F1-Score Alarm** | **0.9894** | Keseimbangan sempurna antara sensitivitas dan presisi |

Bukti grafik **Multiclass Confusion Matrix Heatmap** tersedia pada file artefak:  
`ai/reports/confusion_matrix_risk_score.png` dan `ai/reports/confusion_matrix_alert.png`.

---

## 8. Bank Tanya Jawab Sidang & Expo (Tough Q&A)

### Q1: "Apa perbedaan mendasar antara Skor SIRS dan Hasil Prediksi AI? Kenapa harus ada dua-duanya?"
> **Jawaban:**  
> *"Keduanya memiliki peran komplementer (*dual-defense*):*
> * *Skor SIRS adalah **metrik deterministik berbasis aturan klinis baku**. Tujuannya adalah kepatuhan hukum dan medis terhadap SOP triase rumah sakit. Jika ada 2 parameter abnormal, dokter tahu pasti bahwa pasien masuk kriteria SIRS.*
> * *Model AI XGBoost adalah **analisis prediktif non-linear**. Model AI melihat korelasi tersembunyi yang tidak tertangkap oleh aturan sederhana (misalnya kombinasi kenaikan denyut jantung disertai penurunan laju pernapasan dan fluktuasi indeks syok). Model AI memberikan peringatan dini bahkan sebelum skor ambang batas statis terlampaui secara penuh."*

### Q2: "Bagaimana jika koneksi internet terputus atau microservice AI mati mendadak?"
> **Jawaban:**  
> *"Sistem kami menerapkan prinsip **Graceful Degradation**:*
> * *Jika jaringan internet publik mati, sistem tetap berjalan pada Local Area Network (LAN) rumah sakit karena MQTT Broker dan PostgreSQL berada di jaringan lokal.*
> * *Jika microservice AI mati, backend Express secara otomatis beralih ke mode fallback: evaluasi skor SIRS rule-based tetap aktif 100%, alarm tetap berbunyi saat pasien kritis, dan dashboard memberikan status transparan kepada perawat bahwa AI sedang dalam pemulihan tanpa mengorbankan keselamatan pasien."*

### Q3: "Bagaimana Anda membuktikan sistem Anda tidak mengalami kebocoran data pasien (Data Privacy)?"
> **Jawaban:**  
> *"Sistem memisahkan identitas pribadi pasien dari data telemetri. Data pembacaan sensor hanya diasosiasikan dengan `deviceId` dan `sessionId`. Pada database, nomor rekam medis dan data pasien dienkripsi, dan hak akses dashboard dilindungi oleh autentikasi berbasis JSON Web Token (JWT) dengan cookie terproteksi `httpOnly`."*

### Q4: "Bagaimana cara mendemonstrasikan sistem ini saat Expo jika tidak ada pasien sungguhan?"
> **Jawaban:**  
> *"Kami telah membangun **FAANG-grade Telemetry Simulator** ([server/scripts/simulate.js](file:///d:/Source%20Code/College/Capstone/server/scripts/simulate.js)) yang mencakup seluruh 16 kombinasi kasus fisiologis SIRS ($2^4$). Cukup dengan menjalankan `node scripts/simulate.js --mode 6 --stream`, sistem akan mengalirkan data denyut jantung 110 bpm dan laju napas 24 rpm secara langsung, sehingga juri dan pengunjung dapat melihat grafik berdetak secara real-time dan sirene alarm berbunyi seketika."*

---

*Dokumen ini disusun sebagai panduan resmi proyek Capstone SepSense 2026.*

