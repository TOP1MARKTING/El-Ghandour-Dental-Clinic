# عيادة الغندور الواجهة

Build the complete UI/UX frontend only for a professional dental clinic management system called:

عيادة الغندور للأسنان

VERY IMPORTANT

For this phase, build UI/UX ONLY.

Do NOT implement:

Firebase

Firestore

Firebase Authentication

Backend

API

Database

Real data persistence

Server-side logic

I will implement the complete backend and Firebase integration later in Cursor.

You should focus entirely on:

UI + UX + navigation + screens + components + forms + interactions + responsive design.

The frontend should be structured cleanly so Firebase can be integrated later without rebuilding the UI.

1. Target Users

The system will mainly be used by:

Doctor

The doctor can see everything.

Reception / Data Entry

The reception staff can read and write Arabic, but they are not highly experienced with computer systems.

Therefore:

Simplicity is the most important UX requirement.

The system should feel like:

"دفتر العيادة ولكن إلكتروني ومنظم"

It must be immediately understandable without technical training.

2. Language

The entire UI must be:

Arabic

Use:

RTL

All visible text should be Arabic.

Avoid unnecessary English terminology.

Use simple words such as:

الرئيسية

المرضى

المواعيد

الحسابات

الإعدادات

إضافة مريض

حجز موعد

تسجيل دفعة

زيارة جديدة

تعديل

حفظ

رجوع

بحث

3. Design Direction

Create a modern medical/dental dashboard.

The design should be:

Clean

Comfortable

Professional

Friendly

Simple

Easy on the eyes

Fast to understand

Avoid making it look like a complicated hospital ERP.

Avoid:

Excessive animations

Huge gradients

Too many colors

Tiny text

Tiny buttons

Dense tables

Complicated charts

Excessive cards

Overly technical UI

Use a consistent design system throughout the application.

4. Main Navigation

Keep navigation very simple.

Sidebar:

🏠 الرئيسية

👤 المرضى

📅 المواعيد

💰 الحسابات

⚙️ الإعدادات

At the bottom:

اسم المستخدم

نوع الحساب

تسجيل الخروج

Do not create unnecessary navigation items.

Treatment history and payments should be accessible from the patient profile.

5. Login Screen

Create a professional Arabic login screen.

Show:

عيادة الغندور للأسنان

تسجيل الدخول

Fields:

البريد الإلكتروني

كلمة المرور

Button:

دخول

This is UI only.

Use mock interaction only.

Do not connect authentication.

6. Dashboard / الرئيسية

Create a very simple dashboard.

Top greeting:

صباح الخير 👋

Then show:

مواعيد اليوم

مرضى اليوم

دخل اليوم

باقي عند المرضى

These are UI cards only.

Use realistic placeholder/demo values for visual purposes, but clearly structure them as mock data that can later be replaced with real backend data.

Then:

مواعيد اليوم

Show appointments as simple cards.

Example:

10:00 ص

محمد أحمد

كشف

[تم الحضور]

[لم يحضر]

[إلغاء]

Then:

آخر المرضى

Show a simple list.

7. Quick Actions

This is extremely important.

Put large buttons near the top of the dashboard:

+ إضافة مريض

📅 حجز موعد

🔎 البحث عن مريض

💰 تسجيل دفعة

The receptionist should be able to perform the most common tasks immediately.

8. Patients Page

Create:

المرضى

At the top:

Large search box:

ابحث باسم المريض أو رقم الموبايل

Then:

+ إضافة مريض

Display patients in a clean table on desktop.

Columns:

اسم المريض

رقم الهاتف

السن

آخر زيارة

المدفوع

الباقي

الإجراءات

On mobile, convert the table into patient cards.

Each patient should have:

عرض الملف

9. Add Patient Screen

Create a very simple form.

Title:

إضافة مريض جديد

Fields:

اسم المريض

رقم الموبايل

السن

العنوان

المشكلة

ملاحظات

Primary button:

حفظ المريض

Secondary:

إلغاء

After saving, show a success toast:

تم إضافة المريض بنجاح ✅

This is only a UI interaction.

10. Patient Profile

Create a complete patient profile screen.

Header:

اسم المريض

Show:

رقم الهاتف

السن

العنوان

تاريخ التسجيل

Then three clear financial cards:

إجمالي الحساب

المدفوع

الباقي

Then large action buttons:

📅 حجز موعد

🦷 إضافة زيارة

💰 تسجيل دفعة

Then:

سجل المريض

Create a clean timeline.

Example:

12 سبتمبر

حشو

800 جنيه

ملاحظات الدكتور...

5 سبتمبر

كشف

300 جنيه

ملاحظات...

The design should make the patient's history very easy to understand.

11. Appointment Page

Title:

المواعيد

Create simple navigation:

اليوم

غدًا

القادمة

Show appointment cards.

Each card:

Time

Patient name

Phone

Reason

Status

Buttons:

تم الحضور

لم يحضر

إلغاء

Primary button:

+ حجز موعد

12. Appointment Form

Create:

حجز موعد

Fields:

اسم المريض

التاريخ

الوقت

سبب الزيارة

ملاحظات

Button:

حجز الموعد

Show success toast after submission.

UI only.

13. New Visit

Create:

زيارة جديدة

Fields:

اسم المريض

نوع الزيارة / العلاج

ملاحظات الدكتور

سعر الزيارة

المدفوع

الباقي

Treatment dropdown examples:

كشف

تنظيف

حشو

خلع

تركيب

علاج عصب

أخرى

The UI should visually calculate:

الباقي

using mock frontend state.

No backend.

14. Payments

Create:

الحسابات

Keep it very simple.

Show:

دخل اليوم

دخل الأسبوع

دخل الشهر

باقي عند المرضى

Then:

آخر المدفوعات

Each payment:

اسم المريض

المبلغ

التاريخ

نوع الدفع

Create button:

+ تسجيل دفعة

15. Payment Form

Create:

تسجيل دفعة

Show:

اسم المريض

إجمالي الحساب

المدفوع سابقًا

الباقي

Then:

المبلغ المدفوع الآن

Button:

حفظ الدفعة

The frontend should calculate the new remaining amount using local mock state only.

16. Doctor vs Reception UI

Design the UI so it can later support permissions.

Doctor navigation:

الرئيسية

المرضى

المواعيد

الحسابات

الإعدادات

Reception:

الرئيسية

المرضى

المواعيد

الحسابات

Do not implement real authentication or authorization.

Just structure the components so permissions can be connected later.

17. Settings

Create a simple settings screen.

Sections:

بيانات العيادة

اسم العيادة

رقم الهاتف

العنوان

مواعيد العمل

الحساب

اسم المستخدم

البريد الإلكتروني

No backend functionality.

18. Empty States

Create beautiful empty states.

Examples:

لا يوجد مرضى حتى الآن

لا توجد مواعيد اليوم

لا توجد مدفوعات

Use a simple icon/illustration and a clear CTA.

19. Loading States

Create skeleton loading states for:

Dashboard

Patients

Appointments

Patient profile

Payments

These should be reusable components.

20. Error States

Create friendly Arabic error states.

Example:

حصلت مشكلة

حاول مرة أخرى

Button:

إعادة المحاولة

No technical error messages.

21. Toast Notifications

Create reusable toast UI for:

تم الحفظ بنجاح ✅

تم إضافة المريض ✅

تم حجز الموعد ✅

تم تسجيل الدفعة ✅

تم التعديل بنجاح ✅

22. Confirmation Dialogs

For destructive actions:

هل أنت متأكد من حذف هذا المريض؟

Buttons:

حذف

إلغاء

Create reusable modal/dialog components.

23. Responsive Design

The UI must be excellent on:

Desktop

Laptop

Tablet

Mobile

Desktop:

Sidebar + content.

Mobile:

Use a simple mobile navigation / bottom navigation or collapsible menu.

Buttons must remain large and easy to tap.

24. Accessibility & Usability

Prioritize:

Large readable Arabic text

Clear labels

Strong visual hierarchy

Large clickable areas

Good spacing

Keyboard-friendly forms

Clear focus states

Clear error messages

The receptionist should understand what to do without needing technical knowledge.

25. Reusable Components

Create reusable frontend components for:

Sidebar

Header

Buttons

Inputs

Selects

Modal

Toast

Patient card

Appointment card

Financial card

Empty state

Loading skeleton

Search bar

Status badge

Page header

Keep the component structure clean and scalable.

26. Mock Data

Because there is no backend in this phase, create a small local mock data layer only for demonstrating the UI.

Use realistic Arabic sample data.

Example:

محمد أحمد
01012345678

أحمد محمود
01112345678

Do NOT make the mock data part of the architecture.

It must be easy to remove and replace with Firebase later.

27. Frontend Architecture

Keep the code clean and modular.

Separate:

UI components

Pages

Mock data

Types

Utilities

Do not tightly couple the UI to mock data.

The future Firebase integration should be straightforward.

28. Important UX Rule

Before creating any screen, ask:

هل موظفة عادية في العيادة هتفهم الشاشة دي من أول مرة؟

If not:

Simplify it.

Prioritize:

سهولة الاستخدام > كثرة الخصائص

وضوح الشاشة > كثرة المعلومات

أزرار واضحة > أيقونات غامضة

خطوات أقل > تعقيد أكبر

29. Final Deliverable

Deliver a polished, production-quality frontend UI/UX prototype for:

عيادة الغندور للأسنان

It should include all major screens and user flows:

Login

↓

الرئيسية

↓

إضافة مريض

↓

ملف المريض

↓

حجز موعد

↓

إضافة زيارة

↓

تسجيل دفعة

↓

الحسابات

Everything should work visually using local frontend/mock state only.

Do NOT implement Firebase, authentication backend, Firestore, APIs, or any real database.

I will implement the backend and Firebase integration later in Cursor.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/32f161f3-f4fe-5a39-a338-22a7c2f499dd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
