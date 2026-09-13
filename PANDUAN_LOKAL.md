# Panduan Menjalankan LAMIMI_ID di Lokal (MacBook M1 + VSCode)

## 0. Install yang dibutuhkan (sekali saja)
Buka Terminal, lalu:
```bash
# Homebrew (jika belum): https://brew.sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js + Yarn
brew install node
npm install -g yarn

# Python 3.11
brew install python@3.11

# Note: use python3.11 for venv creation, not the system default Python 3.13

# MongoDB (database)
brew tap mongodb/brew
brew trust mongodb/brew
brew install --build-from-source simdutf
brew install --build-from-source mongodb-community
brew services start mongodb-community
```

## 1. Ekstrak zip & buka di VSCode
Ekstrak `lamimi_project.zip`, lalu File → Open Folder → pilih folder hasil ekstrak.

## 2. Jalankan backend (Terminal 1)
```bash
cd backend
rm -rf .venv
python3.11 -m venv .venv
source .venv/bin/activate
python -m ensurepip --upgrade
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
Catatan dependency: jika `pip install -r requirements.txt` berhenti pada `emergentintegrations==0.2.0`, berarti paket tersebut tidak tersedia dari index publik PyPI di mesin ini; installah dari sumber internal/private atau keluarkan dependency tersebut terlebih dahulu sebelum melanjutkan.
Catatan venv: jika `python -m pip` berkata `No module named pip` atau `source .venv/bin/activate` gagal, hapus folder `.venv` dan buat ulang virtual environment seperti di atas.
Saat pertama jalan, backend otomatis mengisi database lokal dari file `backend/seed_data.json`
(berisi seluruh katalog 133 buku, ongkir JNE, dan metode pembayaran — sama persis dengan data live).
Akun admin otomatis dibuat: admin@lamimi.id / Windy_0803.

## 3. Jalankan frontend (Terminal 2)
```bash
cd frontend
yarn install
yarn dev
```
Buka http://localhost:3000 — selesai. Frontend otomatis meneruskan /api ke backend di port 8001.

## Catatan
- File `backend/.env` sudah berisi konfigurasi lokal (MONGO_URL=mongodb://localhost:27017) — tidak perlu diubah.
- Data pesanan/buku yang kamu ubah di lokal TIDAK tersinkron dengan website live — keduanya database terpisah.
- Barcode QRIS tersimpan sebagai file di `frontend/public/qris-lamimi.png` dan ikut terbawa.
