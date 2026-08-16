# Ambo Health Hub

Master Prompt: IB Tech E-Health Platform for Ambo General Hospital















You are a senior product architect, full-stack engineer, UI/UX strategist, database designer, and AI systems engineer. Your task is to design a production-grade, startup-level, full-stack web platform named “IB Tech E-Health Platform for Ambo General Hospital.”















This is not a demo. This is a real hospital operating system with a polished frontend, secure backend, structured database, intelligent automation, real-time communication, and a modern Ethiopian-inspired visual identity. The platform must feel premium, highly interactive, elegant, and deeply organized.















Core Vision















Build a complete multi-role hospital platform for Ambo General Hospital that manages ownership, administration, room control, patient registration, payment approval, checkups, hospital case management, AI assistance, notifications, media upload, and secure communication.















The system must be:















- visually beautiful and professional







- highly interactive and easy to use







- role-based and permission-driven







- scalable and logically structured







- built with real backend architecture







- optimized for a hospital workflow







- inspired by Ethiopic design culture in a clean, modern way







- capable of handling text, images, PDF files, audio, links, and structured medical data















Recommended Technology Stack















Use the best practical stack for a real-world web application:















- Frontend: React / Next.js







- Styling: Tailwind CSS







- Animations: Framer Motion







- Backend: Node.js + Express or Next.js server actions/API routes







- Database: PostgreSQL







- ORM: Prisma







- Authentication: JWT / session-based secure auth







- Storage: Cloud or object storage for images and documents







- Realtime updates: WebSocket or server-sent updates







- AI integration: use a configurable AI provider through an environment variable















AI key placeholder:







"AI_API_KEY = "AQ.Ab8RN6KKKPs4KMkCqGnYH5bcKuWpdtOykUb2HuZJ7TQ_NEFYHg"















Never hardcode secrets. Read them securely from environment variables.















Design Direction















The interface must be:















- elegant, premium, and highly modern







- inspired by Ethiopian visual language in a non-religious, non-distracting way







- clean with strong spacing, card layouts, smooth transitions, and soft shadows







- enhanced with tasteful 3D-style elements only where they do not disturb usability







- supported by high-quality images, icons, readable typography, and visual hierarchy







- responsive for desktop, tablet, and mobile















The design should include:















- Ethiopian-inspired patterns or motifs used subtly







- rich but controlled color systems







- hospital-grade clarity and trust







- beautiful dashboard layouts







- attractive hero sections, stat panels, timelines, cards, modals, tables, and notification areas







- smooth image sliders for hospital backgrounds







- a premium AI assistant panel















Actors and Roles















The platform must support these actors:















1. Web Admin / Owner







2. Ambo General Hospital Admin / Director







3. Hospital Manager







4. Doctor’s Room







5. Patient















Each actor must have a separate portal with its own permissions, dashboard, data access, actions, notifications, and layout behavior.















---















1) Web Admin / Owner Portal















The first role that opens is the Web Admin.















Entry Rules















- The user selects the role: Web Admin







- Then enters the authorized email address







- Only the exact registered email can access the portal







- Unauthorized users must be blocked completely















Responsibilities















The Web Admin is the top-level owner of the platform and controls:















- all system settings







- user role creation and approval







- hospital portal activation







- global notifications







- communication between portals







- AI settings and assistance







- financial setup rules







- room and service monitoring







- analytics and timeline visibility















Web Admin Features















The portal must include:















- a full dashboard with elegant summary cards







- system settings with beautiful arrangement







- a complete view of the IB Tech startup brand







- chronological visibility into all lower portals







- hospital onboarding workflow







- secure email-based access validation







- approval flow for hospital admin login







- payment configuration control







- service countdown tracking







- all hospital room records visible to the owner







- centralized communication inbox with attachments







- AI assistant capable of processing:







  - text







  - image







  - PDF







  - links







  - document files







  - hospital data summaries















Hospital Setup by Web Admin















The Web Admin sets:















- the official Ambo General Hospital login email







- the service pricing rules







- the bank accounts displayed to the hospital







- the Telebirr phone number and other payment channels







- the service activation flow







- the number of rooms included in the standard yearly package















The Web Admin can also track:















- how long the hospital has been active







- current service status







- payment confirmation status







- room registration progress







- AI-assisted summaries of hospital activity















Subscription Pricing Logic















The initial package includes:















- 100 rooms







- 1 year as the base duration















If the hospital chooses more than one year, calculate additional price using this rule:















- Additional room price = 5% of total yearly price × number of selected years







- Final total = (100-room base price) + additional room price × duration















Show the calculation clearly and elegantly in the portal.















Countdown System















Both the Web Admin portal and the Ambo General Hospital portal must show a live countdown:















- starting from the moment service is activated







- displaying remaining days







- visually elegant and easy to understand















Communication















The Web Admin must be able to communicate with the hospital admin in a Telegram-style interface:















- text







- image







- voice/audio







- PDF







- files







- links















Messages must appear in a clean conversation layout with read indicators and file previews.















---















2) Ambo General Hospital Admin / Director Portal















The hospital admin is the operational owner of the hospital system under the platform owner.















Entry Rules















- Choose role: Ambo General Hospital Admin







- Enter the registered email







- The email must match the one approved by the Web Admin







- Only then does service access begin















Main Responsibilities















The hospital admin manages:















- hospital branding







- room registration







- patient registration rules







- payment verification workflow







- case organization







- room permissions







- patient data control







- hospital images and background media







- AI-assisted overview of hospital operations















Hospital Admin Dashboard















The portal must contain:















- beautiful header branding







- hospital logo







- multiple background images







- elegant dashboard cards







- service status indicators







- notification center







- room control section







- patient management section







- AI assistant panel







- analytics and data overview







- clean Ethiopian-style visual identity















Visual Media Controls















The hospital admin can upload and manage:















- hospital logo







- at least five hospital background images







- image carousel for portal appearance















These images should appear as a smooth rotating display every few seconds on:















- the hospital admin portal







- the manager portal







- the patient portal















The admin can replace or update the visuals anytime.















Room Management















The hospital admin can:















- create rooms up to the approved limit







- name each room







- classify each room as:







  - doctor room







  - manager room







- assign permissions to rooms







- activate or deactivate room access







- view all created rooms















The Web Admin must also be able to view all created rooms.















Hospital Communication















The hospital admin and Web Admin must have a dedicated conversation system that supports:















- text







- image







- voice







- PDF







- file exchange















Patient Registration Fee Control















The hospital admin sets:















- the registration fee that patients must pay once







- the bank accounts used for hospital payments







- the payment information shown to patients















AI Assistant















The hospital admin portal must include a powerful AI assistant that can:















- summarize patients







- summarize rooms







- detect patterns







- present charts, tables, and visual summaries







- answer operational questions







- help with hospital management decisions















The AI output should be visually rich and easy to scan.















---















3) Hospital Manager Portal















The manager portal is the operational center for patient handling and service coordination.















Entry Rules















- choose role: Hospital Manager







- enter permissioned access







- obtain approval from hospital admin if needed















Manager Dashboard Requirements















The manager portal must include:















- hospital logo







- rotating background images set by the hospital admin







- elegant Ethiopian-inspired design







- live date/time control







- notification system







- patient queue







- patient approval workflow







- room assignment section







- case records section







- AI assistant panel















Time Setup















The hospital manager sets:















- year







- month







- day







- hour







- minute







- second















This time display must appear in:















- doctor rooms







- patient portal















Patient Registration Workflow















The manager can register a new patient with the following details:















- full name







- profile picture







- Fayda ID / FAN number (16 digits)







- date of birth







- place of birth







- sex







- phone number







- transaction ID







- case information







- medical notes







- images







- PDFs







- other documents















Store all patient data securely in the database.















Payment Approval Workflow















A patient becomes fully active only after paying the registration fee.















Process















1. The manager registers the patient.







2. The patient opens the patient portal.







3. The patient enters the FAN number.







4. The portal asks for payment proof.







5. The patient uploads a screenshot from the gallery.







6. The screenshot is sent to the manager.







7. The manager approves it manually, or the system validates it automatically.















Notification Design















Incoming payment proofs must appear as:















- red notification alerts







- unread count badges







- clear approval queue















The manager should see:















- how many patients sent payment screenshots







- a list of all waiting approvals







- a clean review interface for each patient















Intelligent Auto-Approval Logic















If the manager does not manually review the screenshot within 1 minute, the system should automatically evaluate it.















The system must inspect:















- payment account used







- amount paid







- transaction ID







- consistency with hospital pricing















If the data matches, the system should:















- save the transaction ID







- approve the patient automatically







- notify the patient with success







- show a green approval indicator in the manager portal















If the screenshot is invalid, the system should:















- reject it







- display a clear warning







- ask the patient to resend the correct proof















Transaction Safety Rule















Transaction IDs must be stored to prevent reuse of the same payment proof for multiple registrations.















If a transaction ID has already been used, the system must:















- reject the new attempt







- notify the patient that the payment must be made personally







- block reused screenshots or duplicated payments















Patient Service Flow















When a registered patient comes for care:















- the manager enters the FAN number







- the patient’s full record appears immediately







- the manager can edit or update it







- the manager assigns the patient to the correct room based on the case















The patient profile should then move into that room’s queue with full history attached.















AI Assistance















The manager portal must include an advanced AI model that can:















- answer hospital workflow questions







- summarize patient records







- generate diagrams or data overviews







- assist with room allocation







- analyze case trends







- support management decisions















---















4) Doctor’s Room Portal















Each doctor room must operate as a secure service unit.















Entry Rules















- choose role: Doctor’s Room







- enter the generated Room ID







- access must only work if the room is approved and valid















Doctor Room Layout















The doctor room must show:















- hospital logo







- hospital background images







- manager-set time







- room title







- patient queue







- case details







- AI assistant panel







- clean, focused clinical interface















Patient Queue















The list of assigned patients must appear in chronological order:















- first sent appears first







- second sent appears second







- and so on















Patient Case View















When the doctor taps a patient:















- the full patient record opens







- all previous cases appear







- current case details are visible







- diagnosis or medical notes can be added







- images can be attached







- prescriptions can be listed







- PDF or reference files can be added















When the doctor saves, all new data must be appended to the patient history and become visible in the patient portal.















Follow-Up and Checkup System















If a patient needs a return visit:















- the doctor sets a checkup date







- the doctor adds a note or reminder message







- that message appears in both:







  - doctor room







  - patient portal















On the checkup date:















- the patient is automatically notified







- the patient is routed back to the same room







- the doctor sees the follow-up reminder automatically















Doctor AI Assistant















The doctor room AI must be powerful and practical. It can:















- summarize patient case history







- suggest possible workflow steps







- display medicine images or references







- offer structured support based on recorded cases







- generate clean visual summaries







- assist without disrupting the doctor’s flow















---















5) Patient Portal















The patient portal is the user-facing health journey interface.















Entry Rules















- choose role: Patient







- enter FAN number







- if already registered, continue to payment verification







- if fully approved, enter the main patient portal



Registration Fee Flow

Before full access:

- the patient is shown the registration fee

- the portal explains where to pay

- the patient pays using an external payment app such as Telebirr or CBE Birr

- the patient uploads the payment screenshot

- the manager or system verifies it



After verification:

- the patient gains access to the full patient portal



Patient Portal Layout

The patient portal must include:

- hospital logo

- hospital name

- live date display

- background images uploaded by the hospital admin

- clean Ethiopian-inspired design(with abstract designs)

- notification area for checkup dates

- AI assistant section

- elegant case history panel

- open-my-case button

- patient-friendly cards and visuals





Open My Case

When the patient clicks Open My Case:

- the full case history appears

- previous diagnoses are visible

- today’s notes appear

- prescriptions are displayed

- uploaded documents can be seen



- checkup alerts are highlighted with a ring or badge notification

Patient Notifications

Patients must receive:

- payment approval status

- checkup date reminders

- room assignment notices

- medical updates

- alert messages from the hospital team



Patient AI Assistant

The patient AI should:

- explain medical notes in simple language

- help the patient understand their case history

- show next steps clearly

- answer portal-related questions

- present information with a friendly, attractive interface

-present in needed file type (text, pictures, audio sound, link etc

---

Data and System Requirements



Required Data Handling

The system must support:

- user authentication

- secure roles

- patient records

- room records

- message threads

- payment proof uploads

- transaction ID history

- checkup schedules

- notification logs

- AI query logs

- hospital branding assets

- activity timeline



File Types

The system must accept:

- text

- images

- PDF files

- audio

- links

- structured data



Database Design

Create a clean relational schema with:

- users

- roles

- hospitals

- rooms

- patients

- patient_cases

- checkups

- payments

- messages

- media_assets

- notifications

- ai_interactions

Security

Include:

- role-based access control

- email verification(google authentication for web admin and hospital admin (his email is setupped by web admin in web admin portal that he is needed to match with in signing)

- protected routes

- secure file upload validation

- duplicate transaction prevention

- permission checks for every action

- audit trail for key events



UX Quality

The interface should be:

- highly readable

- visually premium

- smooth and modern whith a beautiful icon and section 

- interactive without clutter

- fast and responsive

- organized by clear workflow stages



---

Important Missing Features to Add Automatically

Also include any critical hospital-system features that were not explicitly mentioned but are necessary for a real full-stack solution, such as:

- audit logs

- activity history

- backup strategy

- role permissions matrix

- data export

- search and filter

- loading states

- empty states

- error handling

- success toasts

- notification badges

- mobile responsiveness

- multilingual readiness

- admin-level system monitoring

- secure session handling

- privacy and access control

- scalable architecture







---

Final Output Expectations

Generate the complete system as a structured, polished, startup-grade hospital platform with:

- a beautiful landing page(with abstract designs by Ethiopian style)

- role-based dashboards

- a real backend architecture

- secure database logic

- intelligent workflow automation

- advanced AI integration(for all 5 actors roles)

- stunning Ethiopian-inspired UI with abstract designs by Ethiopian style

- premium visual detail

- practical hospital operations support



The final result must feel like a serious health-tech product for Ambo General Hospital, not a school project, not a mockup, and not a simple demo.



Build it with excellence, clarity, intelligence, and visual sophistication.

Don't leave any instructions without adding to this web components, never ever🚫

make it more beautiful as it was desined by highly advanced modern web engineer and scholars.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://aghcare.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0ba1b38d-f80b-4459-9ab7-519a8bfd847f).

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
