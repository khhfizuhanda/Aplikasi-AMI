# Migrasi database AMI ke PostgreSQL lokal

Panduan login lokal terbaru: [README_LOCAL_LOGIN.md](../README_LOCAL_LOGIN.md). Backend kini mendukung login, sesi, logout, perubahan password, dan dashboard PostgreSQL. Catatan fondasi migrasi di bawah menjelaskan kondisi awal; fitur audit lainnya masih perlu dimigrasikan.

Paket ini memindahkan isi spreadsheet database AMI ke PostgreSQL yang dikelola melalui pgAdmin 4.

## Prasyarat

- PostgreSQL Server terpasang dan sedang berjalan.
- pgAdmin 4 terpasang untuk membuat database dan menjalankan query.
- `psql.exe` tersedia di PATH. Biasanya berada di `C:\Program Files\PostgreSQL\<versi>\bin`.
- Project Apps Script masih dapat dibuka untuk membuat snapshot.

> pgAdmin 4 adalah alat administrasi, bukan database server. PostgreSQL Server tetap wajib berjalan.

## 1. Buat snapshot spreadsheet

1. Buka project Apps Script AMI.
2. Jalankan fungsi `exportDatabaseSnapshotToDrive_` dari editor Apps Script.
3. Izinkan akses Drive bila diminta.
4. Dari hasil eksekusi, buka URL file JSON dan download ke folder `postgres`, misalnya `AMI_POSTGRES_SNAPSHOT_20260922_120000.json`.

Exporter membaca semua 26 tabel dari `SHEET_DEFS` dan tidak menghapus atau mengubah spreadsheet sumber.

## 2. Buat database di pgAdmin 4

1. Hubungkan pgAdmin ke server PostgreSQL lokal, biasanya `localhost:5432`.
2. Klik kanan `Databases` > `Create` > `Database`.
3. Isi nama database `ami_local`, owner `postgres`, lalu simpan.
4. Buka `ami_local` > `Tools` > `Query Tool`.
5. Buka dan jalankan [schema.sql](schema.sql).

## 3. Import snapshot

Buka PowerShell dari folder repository lalu jalankan:

```powershell
$env:PGPASSWORD = 'PASSWORD_POSTGRES_ANDA'
.\postgres\import_snapshot.ps1 `
  -SnapshotPath .\postgres\AMI_POSTGRES_SNAPSHOT_20260922_120000.json `
  -Database ami_local `
  -HostName localhost `
  -Port 5432 `
  -User postgres
Remove-Item Env:PGPASSWORD
```

Jika `psql` belum dikenali, tambahkan folder bin PostgreSQL ke PATH atau jalankan dari:

```powershell
& 'C:\Program Files\PostgreSQL\16\bin\psql.exe' --version
```

Password tidak disimpan di file migrasi. Hindari menaruh password di command history pada komputer bersama.

## 4. Verifikasi di pgAdmin

Jalankan query berikut:

```sql
SET search_path TO ami;
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'ami'
ORDER BY table_name;

SELECT 'USERS' AS table_name, count(*) AS rows FROM ami."USERS"
UNION ALL
SELECT 'MASTER_STANDAR', count(*) FROM ami."MASTER_STANDAR"
UNION ALL
SELECT 'AMI_AUDITI', count(*) FROM ami."AMI_AUDITI";
```

Bandingkan jumlah baris dengan spreadsheet sumber sebelum menjadikannya database utama.

## Catatan tentang aplikasi lokal

Perubahan ini memindahkan database dan menyediakan jalur impor yang dapat dijalankan lokal. UI saat ini masih merupakan Google Apps Script Web App dan memanggil `google.script.run`; pgAdmin/PostgreSQL saja tidak dapat menjalankan UI tersebut secara lokal. Agar seluruh aplikasi berjalan tanpa Google, service Apps Script perlu dipindahkan ke backend lokal (misalnya Node.js/Express) dan layanan Google Drive/Docs perlu diganti atau dikonfigurasi ulang. Snapshot ini sengaja menjadi tahap pertama yang tidak mengubah workflow produksi yang sedang berjalan.

Schema awal memakai `TEXT` untuk mempertahankan data spreadsheet tanpa konversi diam-diam. Setelah hasil impor tervalidasi, tipe kolom, primary key, foreign key, dan constraint dapat diperketat pada tahap hardening berikutnya.

## Menjalankan backend lokal

Backend lokal tersedia di `server.js` dan terhubung ke database `ami_local`. Jalankan dari PowerShell tanpa menyimpan password ke file:

```powershell
$secure = Read-Host 'Password PostgreSQL' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
```

Untuk sesi PowerShell yang aman, gunakan nilai password pada environment hanya selama proses berjalan, kemudian jalankan:

```powershell
$env:PGHOST = '127.0.0.1'
$env:PGPORT = '5432'
$env:PGDATABASE = 'ami_local'
$env:PGUSER = 'postgres'
$env:PGSCHEMA = 'ami'
npm start
```

Buka `http://localhost:3000/api/health` untuk memeriksa koneksi. Daftar tabel tersedia di `http://localhost:3000/api/tables`. Backend ini adalah fondasi migrasi; fungsi workflow Apps Script masih perlu dipindahkan ke endpoint lokal secara bertahap.
