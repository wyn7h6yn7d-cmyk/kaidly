import type { Locale } from "../i18n/index.ts";

// Privacy notice and terms, written only from facts about how KAIDLY works. Operator facts
// come from ./operator.ts; {field} placeholders are filled (or marked as missing) when shown.
// Not legal advice and not final until approved (LEGAL.approved).

export type LegalDoc = { title: string; intro: string; sections: { heading: string; body: string[] }[] };
type Docs = { privacy: LegalDoc; terms: LegalDoc; draft: string; missing: Record<string, string>; updated: string };

export const LEGAL_CONTENT: Record<Locale, Docs> = {
  et: {
    draft: "Mustand: see dokument ei ole veel kehtiv. Teenuse osutaja andmed ja õiguslik ülevaatus on kinnitamata.",
    updated: "Kehtib alates",
    missing: {
      operatorName: "teenuse osutaja ärinimi",
      registryCode: "registrikood",
      address: "aadress",
      privacyEmail: "privaatsuse kontakt-e-post",
      effectiveDate: "kehtivuse algus",
      hostingRegion: "andmete töötlemise piirkond",
    },
    privacy: {
      title: "Privaatsus",
      intro: "Kuidas KAIDLY kasutajate ja ettevõtete andmeid töötleb.",
      sections: [
        { heading: "Vastutav töötleja", body: ["{operatorName}, registrikood {registryCode}, {address}. Privaatsusküsimused: {privacyEmail}."] },
        {
          heading: "Milliseid andmeid töötleme",
          body: [
            "Konto: nimi, e-posti aadress, telefon (kui lisad), keelevalik ning sisselogimise andmed. Paroole hoiab autentimisteenus krüpteeritult; KAIDLY ei näe neid.",
            "Ettevõtte andmed, mida kasutajad sisestavad: objektid, elektripaigaldised, käidupäeviku sissekanded, käidukava, puudused, dokumendid ja fotod ning see, kes ja millal need lisas.",
            "Tehnilised andmed: sisselogimise seanss ja serveri tõrkelogid (ilma paroolide ja võtmeteta).",
          ],
        },
        { heading: "Eesmärk", body: ["Andmeid kasutatakse ainult KAIDLY teenuse osutamiseks: konto, ettevõtte käiduandmete pidamine, meeldetuletused, aruanded ja kasutajatugi. Andmeid ei müüda ega kasutata reklaamiks."] },
        {
          heading: "Volitatud töötlejad",
          body: ["Supabase (andmebaas, autentimine ja failid; piirkond: {hostingRegion}) ja Vercel (rakenduse majutus). Kumbki ei kasuta andmeid oma eesmärkidel."],
        },
        {
          heading: "Küpsised",
          body: ["KAIDLY kasutab ainult hädavajalikke küpsiseid: sisselogimise seanss, keelevalik, viimati avatud ettevõte ja alustamise juhendi peitmine. Analüütika- ega reklaamiküpsiseid ei ole."],
        },
        {
          heading: "Säilitamine ja kustutamine",
          body: [
            "Midagi ei kustutata automaatselt. Konto kustutamist saab taotleda konto lehelt; kontoandmed kustutatakse pärast käsitsi ülevaatust.",
            "Ettevõtte käiduandmed (sissekanded, puudused, dokumendid) kuuluvad ettevõttele ja võivad olla vajalikud selle seaduslike kohustuste täitmiseks; nende säilitamine otsustatakse koos ettevõttega.",
          ],
        },
        {
          heading: "Sinu õigused",
          body: ["Sul on õigus oma andmetega tutvuda, neid parandada, taotleda kustutamist või töötlemise piiramist ja saada oma andmed kaasaskantaval kujul. Kaebuse saad esitada Andmekaitse Inspektsioonile."],
        },
      ],
    },
    terms: {
      title: "Kasutustingimused",
      intro: "KAIDLY kasutamise põhireeglid.",
      sections: [
        { heading: "Teenuse osutaja", body: ["{operatorName}, registrikood {registryCode}, {address}."] },
        { heading: "Teenus", body: ["KAIDLY on digitaalne käidupäevik elektripaigaldistele: objektid, paigaldised, käidupäevik, käidukava, puudused, dokumendid, meeldetuletused ja aruanded."] },
        {
          heading: "Prooviperiood ja ligipääs",
          body: [
            "Igal uuel ettevõttel on 14-päevane prooviperiood täieliku ligipääsuga. Seejärel jääb ettevõte ainult vaatamiseks: andmed säilivad ja neid saab vaadata ning eksportida, kuid uusi kirjeid lisada ei saa.",
            "Täiskasutus aktiveeritakse kokkuleppel KAIDLYga.",
          ],
        },
        {
          heading: "Kasutaja vastutus",
          body: [
            "Ettevõte ja selle kasutajad vastutavad sisestatud andmete õigsuse ning oma seaduslike kohustuste (sh elektripaigaldise käidu nõuete) täitmise eest. KAIDLY on tööriist ega asenda pädeva isiku hinnangut.",
            "Kontot ei tohi jagada ega teenust kuritarvitada (nt failide massiline üleslaadimine).",
          ],
        },
        { heading: "Kättesaadavus", body: ["Teenust osutatakse parima võimaliku hoolega; hooldustöödest ja katkestustest teavitatakse võimaluse korral ette."] },
        { heading: "Kontakt", body: ["{privacyEmail}"] },
      ],
    },
  },
  en: {
    draft: "Draft: this document is not yet in force. The service operator's details and the legal review are not confirmed.",
    updated: "Effective from",
    missing: {
      operatorName: "service operator's legal name",
      registryCode: "registry code",
      address: "address",
      privacyEmail: "privacy contact email",
      effectiveDate: "effective date",
      hostingRegion: "data processing region",
    },
    privacy: {
      title: "Privacy",
      intro: "How KAIDLY processes users' and organisations' data.",
      sections: [
        { heading: "Controller", body: ["{operatorName}, registry code {registryCode}, {address}. Privacy questions: {privacyEmail}."] },
        {
          heading: "What we process",
          body: [
            "Account: name, email address, phone (if added), language and sign-in data. Passwords are stored encrypted by the authentication service; KAIDLY cannot see them.",
            "Organisation data entered by users: sites, electrical installations, operating-log entries, operating plan, deficiencies, documents and photos, and who added them when.",
            "Technical data: the sign-in session and server error logs (without passwords or keys).",
          ],
        },
        { heading: "Purpose", body: ["Data is used only to provide KAIDLY: accounts, the organisation's operating records, reminders, reports and support. It is not sold or used for advertising."] },
        { heading: "Processors", body: ["Supabase (database, authentication and files; region: {hostingRegion}) and Vercel (application hosting). Neither uses the data for its own purposes."] },
        {
          heading: "Cookies",
          body: ["KAIDLY uses only strictly necessary cookies: the sign-in session, language, the last opened organisation and the hidden getting-started guide. There are no analytics or advertising cookies."],
        },
        {
          heading: "Retention and deletion",
          body: [
            "Nothing is deleted automatically. Account deletion can be requested from the account page; account data is deleted after a manual review.",
            "Organisation records (entries, deficiencies, documents) belong to the organisation and may be needed for its legal obligations; their retention is decided together with the organisation.",
          ],
        },
        {
          heading: "Your rights",
          body: ["You may access and correct your data, request erasure or restriction, and receive your data in a portable form. You can lodge a complaint with the Estonian Data Protection Inspectorate."],
        },
      ],
    },
    terms: {
      title: "Terms of use",
      intro: "The basic rules for using KAIDLY.",
      sections: [
        { heading: "Service operator", body: ["{operatorName}, registry code {registryCode}, {address}."] },
        { heading: "The service", body: ["KAIDLY is a digital operating log for electrical installations: sites, installations, operating log, operating plan, deficiencies, documents, reminders and reports."] },
        {
          heading: "Trial and access",
          body: [
            "Every new organisation gets a 14-day trial with full access. Afterwards it becomes read-only: the data is kept and can be viewed and exported, but no new records can be added.",
            "Full access is activated by agreement with KAIDLY.",
          ],
        },
        {
          heading: "Your responsibility",
          body: [
            "The organisation and its users are responsible for the accuracy of the data and for meeting their legal obligations (including those for operating electrical installations). KAIDLY is a tool and does not replace a competent person's judgement.",
            "Accounts must not be shared and the service must not be abused (e.g. mass file uploads).",
          ],
        },
        { heading: "Availability", body: ["The service is provided with due care; maintenance and interruptions are announced in advance where possible."] },
        { heading: "Contact", body: ["{privacyEmail}"] },
      ],
    },
  },
  ru: {
    draft: "Черновик: документ ещё не действует. Данные поставщика услуги и юридическая проверка не подтверждены.",
    updated: "Действует с",
    missing: {
      operatorName: "наименование поставщика услуги",
      registryCode: "регистрационный код",
      address: "адрес",
      privacyEmail: "e-mail по вопросам конфиденциальности",
      effectiveDate: "дата вступления в силу",
      hostingRegion: "регион обработки данных",
    },
    privacy: {
      title: "Конфиденциальность",
      intro: "Как KAIDLY обрабатывает данные пользователей и организаций.",
      sections: [
        { heading: "Ответственный обработчик", body: ["{operatorName}, регистрационный код {registryCode}, {address}. Вопросы конфиденциальности: {privacyEmail}."] },
        {
          heading: "Какие данные мы обрабатываем",
          body: [
            "Учётная запись: имя, e-mail, телефон (если указан), язык и данные входа. Пароли хранятся в зашифрованном виде службой аутентификации; KAIDLY их не видит.",
            "Данные организации, которые вводят пользователи: объекты, электроустановки, записи оперативного журнала, план эксплуатации, дефекты, документы и фотографии, а также кто и когда их добавил.",
            "Технические данные: сеанс входа и журналы ошибок сервера (без паролей и ключей).",
          ],
        },
        { heading: "Цель", body: ["Данные используются только для работы KAIDLY: учётные записи, эксплуатационные записи организации, напоминания, отчёты и поддержка. Данные не продаются и не используются для рекламы."] },
        { heading: "Обработчики", body: ["Supabase (база данных, аутентификация и файлы; регион: {hostingRegion}) и Vercel (размещение приложения). Ни один из них не использует данные в своих целях."] },
        {
          heading: "Файлы cookie",
          body: ["KAIDLY использует только необходимые cookie: сеанс входа, язык, последняя открытая организация и скрытое руководство по началу работы. Аналитических и рекламных cookie нет."],
        },
        {
          heading: "Хранение и удаление",
          body: [
            "Ничего не удаляется автоматически. Удаление учётной записи можно запросить на странице учётной записи; данные учётной записи удаляются после ручной проверки.",
            "Эксплуатационные записи организации (записи, дефекты, документы) принадлежат организации и могут быть нужны для выполнения её юридических обязанностей; их хранение решается вместе с организацией.",
          ],
        },
        {
          heading: "Ваши права",
          body: ["Вы можете ознакомиться со своими данными, исправить их, запросить удаление или ограничение обработки и получить данные в переносимом виде. Жалобу можно подать в Инспекцию по защите данных Эстонии."],
        },
      ],
    },
    terms: {
      title: "Условия использования",
      intro: "Основные правила использования KAIDLY.",
      sections: [
        { heading: "Поставщик услуги", body: ["{operatorName}, регистрационный код {registryCode}, {address}."] },
        { heading: "Услуга", body: ["KAIDLY — цифровой оперативный журнал для электроустановок: объекты, электроустановки, оперативный журнал, план эксплуатации, дефекты, документы, напоминания и отчёты."] },
        {
          heading: "Пробный период и доступ",
          body: [
            "Каждая новая организация получает 14-дневный пробный период с полным доступом. Затем организация доступна только для просмотра: данные сохраняются, их можно просматривать и экспортировать, но новые записи добавлять нельзя.",
            "Полный доступ активируется по договорённости с KAIDLY.",
          ],
        },
        {
          heading: "Ответственность пользователя",
          body: [
            "Организация и её пользователи отвечают за точность данных и выполнение своих юридических обязанностей (в том числе по эксплуатации электроустановок). KAIDLY — инструмент и не заменяет оценку компетентного лица.",
            "Нельзя передавать учётную запись другим или злоупотреблять услугой (например, массово загружать файлы).",
          ],
        },
        { heading: "Доступность", body: ["Услуга предоставляется с должной заботой; о плановых работах и перерывах по возможности сообщается заранее."] },
        { heading: "Контакт", body: ["{privacyEmail}"] },
      ],
    },
  },
};
