AMI UMA 2026 — V28 FULL PRODUCTION
Tanggal: 10 September 2026
Backend: 1.6.2-user-password-bulk-v28
UI Build: AMI-UI-USER-PASSWORD-BULK-10SEP2026-V28

PERUBAHAN V28
- Menu Akun Pengguna mendukung Reset Password individual, akun terpilih, dan semua pengguna.
- Checkbox pilih semua / sebagian tersedia di tabel akun.
- Reset massal menggunakan satu transaksi backend dan batch update untuk menjaga performa.
- Password sementara default: ami2026!
- Semua akun yang direset diwajibkan mengganti password saat login berikutnya.
- Session lama akun target dinonaktifkan.
- Akun ADMIN_BPM yang sedang digunakan dikecualikan dari reset massal agar Admin tidak terputus dari aplikasi. Reset individual tetap tersedia bila benar-benar diperlukan.
- Seluruh fitur V27 production hardening tetap dipertahankan.

DEPLOY
1. Backup project Apps Script dan spreadsheet database.
2. Gunakan hanya 16 file source utama dalam paket ini. Jangan pertahankan patch/service lama yang menduplikasi fungsi.
3. Save All.
4. Deploy > Manage deployments > Edit > New version > Deploy.
5. Hard refresh browser.
6. Pastikan build login menampilkan AMI-UI-USER-PASSWORD-BULK-10SEP2026-V28.

TIDAK PERLU
- Tidak perlu setupDatabase().
- Tidak perlu menghapus database/sheet.
- Tidak ada schema baru.

RESET PASSWORD MASSAL
Admin BPM > Akun Pengguna:
- centang akun tertentu > Reset Terpilih; atau
- Reset Semua Pengguna.
Password sementara menjadi ami2026!, ForceChangePassword=true, dan session lama target ditutup.
