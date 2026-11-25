# Demo Task Board (Next.js)

โปรเจกต์ Next.js 14 (App Router + TypeScript) ขนาดเล็ก สำหรับทดสอบ GitHub App ระบบออโต้แจกงานรีวิว

## เริ่มใช้งาน
```bash
npm install
npm run dev   # http://localhost:3000
```

## ใช้ทดสอบระบบแจกงานรีวิว
1. สร้าง repo ใหม่บน GitHub แล้ว push โปรเจกต์นี้ขึ้นไป
2. ติดตั้ง GitHub App ของคุณใน repo นั้น
3. แก้ `.github/CODEOWNERS` ให้เป็นชื่อผู้ใช้/ทีมจริง
4. สร้าง branch → แก้ไฟล์เล็กน้อย (เช่น `components/Board.tsx`, `lib/tasks.ts`) → เปิด Pull Request
5. ตรวจว่าระบบกำหนด reviewer ให้อัตโนมัติ

## โครงสร้าง
- `app/` – หน้าเว็บและ API route (`/api/tasks`)
- `components/Board.tsx` – กระดานงาน (client component)
- `lib/tasks.ts` – ข้อมูลในหน่วยความจำ
- `.github/` – CODEOWNERS, PR template, CI workflow

## ไฟล์ขนาดใหญ่
- `lib/seed-data.ts` – ข้อมูลตัวอย่าง 250 รายการ (มากกว่า 2,000 บรรทัด) ใช้ทดสอบ PR ที่มีไฟล์ยาว
- `GET /api/seed` – สรุปจำนวนงานจากข้อมูลตัวอย่าง
