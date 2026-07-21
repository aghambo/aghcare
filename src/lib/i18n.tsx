import { useEffect, useState } from "react";
import { Globe } from "lucide-react";

export type Lang = "en" | "am" | "om";

const LANG_KEY = "ibtech-lang";
const EVT = "ibtech-lang-change";

export function getLang(): Lang {
  if (typeof window === "undefined") return "en";
  return ((localStorage.getItem(LANG_KEY) as Lang) ?? "en") as Lang;
}

export function setLang(lang: Lang) {
  localStorage.setItem(LANG_KEY, lang);
  window.dispatchEvent(new CustomEvent(EVT));
}

/** Global reactive language hook — every mounted component re-renders on switch. */
export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, set] = useState<Lang>(() => getLang());
  useEffect(() => {
    const on = () => set(getLang());
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return [lang, setLang];
}

/** Translation dictionary. Extend keys as new UI strings are added. */
const DICT: Record<string, { en: string; am: string; om: string }> = {
  // Common
  "app.title": {
    en: "IB Tech E-Health",
    am: "IB Tech ኢ-ጤና",
    om: "IB Tech E-Fayyaa",
  },
  "hospital.name": {
    en: "Ambo General Hospital",
    am: "አምቦ አጠቃላይ ሆስፒታል",
    om: "Hospitaala Waliigalaa Amboo",
  },
  "nav.signOut": { en: "Sign out", am: "ውጣ", om: "Bahi" },
  "nav.language": { en: "Language", am: "ቋንቋ", om: "Afaan" },
  "nav.notifications": { en: "Notifications", am: "ማሳወቂያዎች", om: "Beeksisa" },
  "nav.messages": { en: "Messages", am: "መልእክቶች", om: "Ergaawwan" },
  "common.save": { en: "Save", am: "አስቀምጥ", om: "Olkaa'i" },
  "common.cancel": { en: "Cancel", am: "ሰርዝ", om: "Haquu" },
  "common.remove": { en: "Remove", am: "አስወግድ", om: "Buqqisi" },
  "common.add": { en: "Add", am: "ጨምር", om: "Dabaluu" },
  "common.email": { en: "Email", am: "ኢሜይል", om: "Imeelii" },
  "common.role": { en: "Role", am: "ሚና", om: "Gahee" },
  "common.status": { en: "Status", am: "ሁኔታ", om: "Haala" },
  "common.name": { en: "Name", am: "ስም", om: "Maqaa" },
  "common.phone": { en: "Phone", am: "ስልክ", om: "Bilbila" },

  // Landing
  "landing.hero.tagline": {
    en: "Ambo General Hospital, run with excellence.",
    am: "አምቦ አጠቃላይ ሆስፒታል፣ በበላይነት ይመራ።",
    om: "Hospitaalli Waliigalaa Amboo, of-eeggannoodhaan hoogganamu.",
  },
  "landing.enterPortal": { en: "Enter your portal", am: "ወደ ፖርታልዎ ግቡ", om: "Portaalii keessan seenaa" },
  "landing.iAmPatient": { en: "I am a patient", am: "እኔ ታካሚ ነኝ", om: "Ani dhukkubsataadha" },
  "landing.chooseRole": { en: "Choose your role", am: "ሚናዎን ይምረጡ", om: "Gahee kee filadhu" },

  // Roles
  "role.web_admin": { en: "Web Admin / Owner", am: "የድር አስተዳዳሪ / ባለቤት", om: "Bulchaa Weeb / Abbaa" },
  "role.hospital_admin": {
    en: "Hospital Admin / Director",
    am: "የሆስፒታል አስተዳዳሪ / ዳይሬክተር",
    om: "Bulchaa Hospitaalaa / Daayirekteera",
  },
  "role.manager": { en: "Hospital Manager", am: "የሆስፒታል ሥራ አስኪያጅ", om: "Maanejera Hospitaalaa" },
  "role.doctor_room": { en: "Doctor's Room", am: "የዶክተር ክፍል", om: "Kutaa Doktoraa" },
  "role.patient": { en: "Patient", am: "ታካሚ", om: "Dhukkubsataa" },

  // Patient
  "patient.portal": { en: "Patient Portal", am: "የታካሚ ፖርታል", om: "Portaalii Dhukkubsataa" },
  "patient.enterFan": {
    en: "Enter your Fayda ID / FAN number (16 digits) to open your health journey.",
    am: "የፋይዳ መታወቂያዎን (16 አሃዞች) ያስገቡ።",
    om: "Waraqaa Enyummaa Faayidaa (lakkoofsa 16) galchi.",
  },
  "patient.continue": { en: "Continue", am: "ቀጥል", om: "Itti fufi" },
  "patient.openCase": { en: "Open my case", am: "ጉዳዬን ክፈት", om: "Dhimma koo bani" },
  "patient.closeCase": { en: "Close my case", am: "ጉዳዬን ዝጋ", om: "Dhimma koo cufi" },
  "patient.caseHistory": { en: "Case history", am: "የጉዳይ ታሪክ", om: "Seenaa dhimma" },
  "patient.paymentRequired": { en: "Payment required", am: "ክፍያ ያስፈልጋል", om: "Kaffaltiin barbaachisaadha" },
  "patient.payNow": { en: "Pay now", am: "አሁን ክፈል", om: "Amma kaffaluu" },
  "patient.registrationFee": { en: "Registration fee", am: "የምዝገባ ክፍያ", om: "Kaffaltii galmee" },
  "patient.txnId": { en: "Transaction ID", am: "የግብይት መለያ", om: "Lakkoofsa Kaffaltii" },
  "patient.amountPaid": { en: "Amount paid (ETB)", am: "የተከፈለ መጠን (ብር)", om: "Hamma kaffalame (ETB)" },
  "patient.uploadShot": {
    en: "Upload payment screenshot",
    am: "የክፍያ ስክሪንሾት ስቀል",
    om: "Suuraa kaffaltii ol-fe'i",
  },

  // Manager
  "manager.title": { en: "Hospital Manager", am: "የሆስፒታል ሥራ አስኪያጅ", om: "Maanejera Hospitaalaa" },
  "manager.registerPatient": { en: "Register a new patient", am: "አዲስ ታካሚ መዝግብ", om: "Dhukkubsataa haaraa galmeessi" },
  "manager.fullName": { en: "Full name", am: "ሙሉ ስም", om: "Maqaa guutuu" },
  "manager.fan": { en: "Fayda ID / FAN (16 digits)", am: "የፋይዳ መታወቂያ (16 አሃዞች)", om: "Faayidaa (lakk. 16)" },
  "manager.dob": { en: "Date of birth", am: "የልደት ቀን", om: "Guyyaa dhalootaa" },
  "manager.sex": { en: "Sex", am: "ጾታ", om: "Saala" },
  "manager.female": { en: "Female", am: "ሴት", om: "Dubartii" },
  "manager.male": { en: "Male", am: "ወንድ", om: "Dhiira" },
  "manager.pob": { en: "Place of birth", am: "የትውልድ ቦታ", om: "Bakka dhalootaa" },
  "manager.phone": { en: "Phone number", am: "ስልክ ቁጥር", om: "Lakkoofsa bilbilaa" },
  "manager.emergencyPhone": {
    en: "Emergency phone number",
    am: "የአደጋ ጊዜ ስልክ ቁጥር",
    om: "Lakk. bilbila balaa yeroo",
  },
  "manager.caseInfo": { en: "Case information", am: "የጉዳይ መረጃ", om: "Odeeffannoo dhimma" },
  "manager.notes": { en: "Medical notes", am: "የህክምና ማስታወሻ", om: "Yaadannoo yaalii" },
  "manager.hasInsurance": {
    en: "Patient has health insurance",
    am: "ታካሚ የጤና መድህን አለው",
    om: "Dhukkubsataan inshuraansii fayyaa qaba",
  },
  "manager.register": { en: "Register patient", am: "ታካሚ መዝግብ", om: "Dhukkubsataa galmeessi" },

  // Admin user management
  "admin.userManagement": { en: "User management", am: "የተጠቃሚ አስተዳደር", om: "Bulchiinsa fayyadamtootaa" },
  "admin.authorized": { en: "Authorized accounts", am: "የተፈቀደላቸው መለያዎች", om: "Herrega heeyyamame" },
  "admin.addAccount": { en: "Add account", am: "መለያ ጨምር", om: "Herrega dabali" },
  "admin.confirmRemove": {
    en: "Remove this account? They will lose access immediately.",
    am: "ይህን መለያ ማስወገድ? መዳረሻ ወዲያውኑ ይጠፋል።",
    om: "Herrega kana buqqisuu? Battalatti argachuu dhabu.",
  },
};

export function t(key: string, lang?: Lang): string {
  const l = lang ?? getLang();
  const entry = DICT[key];
  if (!entry) return key;
  return entry[l] ?? entry.en;
}

/** Compact language switcher for portal headers. */
export function LanguageSwitcher() {
  const [lang, set] = useLang();
  return (
    <label className="flex h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-2 shadow-card">
      <Globe className="h-4 w-4 text-primary" />
      <select
        value={lang}
        onChange={(e) => set(e.target.value as Lang)}
        className="bg-transparent text-xs font-bold outline-none"
        aria-label="Language"
      >
        <option value="en">EN</option>
        <option value="am">አማርኛ</option>
        <option value="om">Afaan Oromoo</option>
      </select>
    </label>
  );
}
