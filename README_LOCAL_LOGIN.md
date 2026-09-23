# Menjalankan AMI lokal

1. Pastikan PostgreSQL berjalan dan database `ami_local` telah memiliki schema dari `postgres/schema.sql`.
2. Salin `.env.example` menjadi `.env`, lalu isi `PGPASSWORD` dengan password PostgreSQL yang benar. Server membaca `.env` otomatis. Jangan bagikan file ini.
3. Jalankan `npm start` dari folder ini dan biarkan terminal tetap terbuka.
4. Buka **http://localhost:3000/?view=login**. Jangan membuka HTML langsung atau menggunakan Live Server.
5. Periksa **http://localhost:3000/api/health**. Nilai `ok: true` menunjukkan koneksi PostgreSQL berhasil.

Alternatif tanpa menyimpan password: jalankan `powershell -ExecutionPolicy Bypass -File .\START_AMI.ps1`. Script meminta password PostgreSQL secara tersembunyi jika `.env` belum tersedia.

Jika username `admin` belum ada, startup membuat akun lokal `admin` dengan password `admin123`. Akun admin yang sudah ada tidak diubah. Setelah login, ganti password melalui tombol **Ganti Password**.

Password PostgreSQL berbeda dari password akun AMI. Jika konfigurasi database berubah, restart server. Port dapat diubah melalui `PORT` di `.env`; gunakan alamat yang ditampilkan terminal.

Backend lokal mendukung login, dashboard publik dan dashboard sesuai peran, pemulihan sesi saat reload, logout, serta perubahan password. Perhitungan dashboard memakai service AMI yang ada dengan data PostgreSQL. Fungsi pengelolaan audit, impor/ekspor, dan dokumen Google belum dimigrasikan; endpoint yang belum tersedia menampilkan pesan eksplisit.

`npm test` menguji login, dashboard, pemulihan/pencabutan sesi, kredensial salah, gangguan database, rendering HTML, dan pembatasan akses file dengan database pengujian tiruan. Ini tidak menggantikan pemeriksaan login terhadap PostgreSQL asli.
