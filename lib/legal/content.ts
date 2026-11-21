// JURISTI ÜLEVAATUS VAJALIK — privacy notice, terms of use and data processing agreement.
//
// Written only from facts about how KAIDLY works (code, docs/SECURITY_AUDIT.md,
// docs/SITE_VIEWERS.md). No certifications or standards are claimed. Operator facts come
// from ./operator.ts (and lib/company.ts); {field} placeholders are filled when shown, or the
// whole paragraph is replaced by one "published before launch" sentence while a fact is
// missing. [label](/path) renders an internal link. Not legal advice and not final until
// approved (LEGAL.approved). Estonian is the source; English and Russian: TÕLGE ÜLE VAADATA.
import type { Locale } from "../i18n/index.ts";

export type LegalDoc = { title: string; intro: string; sections: { heading: string; body: string[] }[] };
export type LegalDocKey = "privacy" | "terms" | "dpa";
type Docs = Record<LegalDocKey, LegalDoc> & {
  pending: string;
  draft: Record<LegalDocKey, string>;
  missing: Record<string, string>;
  updated: string;
};

export const LEGAL_CONTENT: Record<Locale, Docs> = {
  et: {
    pending: "See osa avaldatakse enne teenuse ametlikku käivitamist.",
    draft: {
      privacy: "Eelversioon. KAIDLY privaatsustingimused täiendatakse enne teenuse avalikku käivitamist.",
      terms: "Eelversioon. KAIDLY kasutustingimused täiendatakse enne teenuse avalikku käivitamist.",
      dpa: "Eelversioon. KAIDLY andmetöötlusleping täiendatakse enne teenuse avalikku käivitamist.",
    },
    updated: "Kehtib alates",
    missing: {
      operatorName: "teenuse osutaja ärinimi",
      registryCode: "registrikood",
      address: "aadress",
      privacyEmail: "privaatsuse kontakt-e-post",
      effectiveDate: "kehtivuse algus",
      hostingRegion: "andmebaasi piirkond",
      appRegion: "rakenduse majutuse piirkond",
      emailRegion: "e-kirjade saatmise piirkond",
      contactEmail: "kontakt-e-post",
    },
    privacy: {
      title: "Privaatsus",
      intro: "Kuidas KAIDLY kasutajate ja ettevõtete andmeid töötleb.",
      sections: [
        {
          heading: "Teenuse osutaja ja vastutav töötleja",
          body: [
            "{operatorName}, registrikood {registryCode}, {address}. Privaatsusküsimused: {privacyEmail}.",
            "KAIDLY on vastutav töötleja kasutajakontode andmete osas. Andmete osas, mida kliendid (ettevõtted) KAIDLY-sse oma töö käigus sisestavad, on vastutav töötleja klient ja KAIDLY on volitatud töötleja — vt [andmetöötlusleping](/andmetootlusleping).",
          ],
        },
        {
          heading: "Milliseid andmeid töötleme",
          body: [
            "Konto: nimi, e-posti aadress, telefon (kui lisad), keelevalik ning sisselogimise andmed. Paroole hoiab autentimisteenus räsitud kujul; KAIDLY ei näe neid.",
            "Andmed, mida ettevõtted sisestavad: objektid, elektripaigaldised, käidupäeviku sissekanded, käidukava, puudused, dokumentide ja fotode lingid ning see, kes ja millal need lisas. Need võivad sisaldada isikuandmeid, näiteks tööde tegijate ja vastutavate isikute nimesid.",
            "Objekti vaatajad (nt objekti omanik või korteriühistu juhatus): nimi ja e-posti aadress ning see, millistele objektidele neil on ligipääs ja kes kutse saatis.",
            "Tehnilised andmed: sisselogimise seanss ja serveri tõrkelogid (ilma paroolide, võtmete ja kutsetokeniteta).",
            "KAIDLY ei hoia kasutajate faile: dokumendid ja fotod jäävad kliendi enda valitud kohta ning KAIDLY salvestab ainult lingi.",
          ],
        },
        {
          heading: "Eesmärk",
          body: [
            "Andmeid kasutatakse ainult KAIDLY teenuse osutamiseks: kontod, ettevõtte käiduandmete pidamine, meeldetuletused, aruanded ja kasutajatugi. Andmeid ei müüda ega kasutata reklaamiks.",
          ],
        },
        {
          heading: "Alamtöötlejad ja andmete asukoht",
          body: [
            "Supabase — andmebaas ja autentimine; piirkond: {hostingRegion}.",
            "Vercel — rakenduse majutus; piirkond: {appRegion}.",
            "Resend — e-kirjade saatmine (konto kinnitamine, parooli lähtestamine, turvateated ja kasutaja soovil tähtaja meeldetuletused); piirkond: {emailRegion}.",
            "KAIDLY ei kasuta analüütika-, reklaami- ega jälgimisteenuseid.",
          ],
        },
        {
          heading: "Küpsised",
          body: [
            "KAIDLY kasutab ainult hädavajalikke küpsiseid: sisselogimise seanss, keelevalik, viimati avatud ettevõte ja alustamise juhendi peitmine. Analüütika- ega reklaamiküpsiseid ei ole.",
          ],
        },
        {
          heading: "Säilitamine ja kustutamine",
          body: [
            "Midagi ei kustutata automaatselt. Konto kustutamist saab taotleda konto lehelt; kontoandmed kustutatakse pärast käsitsi ülevaatust.",
            "Ettevõtte käiduandmed (sissekanded, puudused, dokumentide lingid) kuuluvad ettevõttele ja võivad olla vajalikud selle seaduslike kohustuste täitmiseks; nende säilitamine ja kustutamine toimub vastavalt [andmetöötluslepingule](/andmetootlusleping).",
            "Objekti vaataja ligipääsu äravõtmisel jääb alles märge, kes ja millal ligipääsu omas ja selle ära võttis.",
          ],
        },
        {
          heading: "Sinu õigused",
          body: [
            "Sul on õigus oma andmetega tutvuda, neid parandada, taotleda kustutamist või töötlemise piiramist ja saada oma andmed kaasaskantaval kujul. Kaebuse saad esitada Andmekaitse Inspektsioonile.",
          ],
        },
        { heading: "Kontakt", body: ["{contactEmail}"] },
      ],
    },
    terms: {
      title: "Kasutustingimused",
      intro: "KAIDLY kasutamise põhireeglid.",
      sections: [
        { heading: "Teenuse osutaja", body: ["{operatorName}, registrikood {registryCode}, {address}."] },
        {
          heading: "Teenus",
          body: [
            "KAIDLY on digitaalne käidupäevik elektripaigaldistele: objektid, paigaldised, käidupäevik, käidukava, puudused, dokumentide lingid, meeldetuletused ja aruanded.",
          ],
        },
        {
          heading: "Prooviperiood ja ligipääs",
          body: [
            "Kasutaja esimesel ettevõttel on 14-päevane prooviperiood täieliku ligipääsuga. Seejärel jääb ettevõte ainult vaatamiseks: andmed säilivad ja neid saab vaadata ning eksportida, kuid uusi kirjeid lisada ei saa.",
            "Täiskasutus aktiveeritakse kokkuleppel KAIDLY-ga.",
          ],
        },
        {
          heading: "Kasutaja vastutus",
          body: [
            "Ettevõte ja selle kasutajad vastutavad sisestatud andmete õigsuse ning oma seaduslike kohustuste (sh elektripaigaldise käidu nõuete) täitmise eest. KAIDLY on tööriist ega asenda pädeva isiku hinnangut.",
            "Kontot ei tohi jagada ega teenust kuritarvitada.",
          ],
        },
        {
          heading: "Isikuandmete töötlemine",
          body: [
            "Isikuandmete osas, mida klient KAIDLY-sse sisestab, on klient vastutav töötleja ja KAIDLY volitatud töötleja. Töötlemise tingimused on kirjas [andmetöötluslepingus](/andmetootlusleping), mis on nende kasutustingimuste osa.",
          ],
        },
        { heading: "Kättesaadavus", body: ["Teenust osutatakse parima võimaliku hoolega; hooldustöödest ja katkestustest teavitatakse võimaluse korral ette."] },
        { heading: "Kontakt", body: ["{contactEmail}"] },
      ],
    },
    dpa: {
      title: "Andmetöötlusleping",
      intro:
        "Tingimused, mille alusel KAIDLY töötleb kliendi nimel isikuandmeid (isikuandmete kaitse üldmääruse artikkel 28).",
      sections: [
        {
          heading: "Pooled",
          body: [
            "Vastutav töötleja on klient — ettevõte, kes kasutab KAIDLY-t. Volitatud töötleja on {operatorName}, registrikood {registryCode}, {address}.",
            "See leping on [kasutustingimuste](/kasutustingimused) osa.",
          ],
        },
        {
          heading: "Töötlemise ese, laad, eesmärk ja kestus",
          body: [
            "Ese ja eesmärk: KAIDLY teenuse osutamine — elektripaigaldiste käiduandmete (objektid, paigaldised, käidupäevik, käidukava, puudused, dokumentide lingid) pidamine, meeldetuletused, aruanded ja kasutajatugi.",
            "Laad: andmete salvestamine, kuvamine, otsimine, aruannete koostamine ja meeldetuletuste saatmine.",
            "Kestus: kogu aja, mil klient teenust kasutab, ning pärast seda kuni andmete tagastamise või kustutamiseni vastavalt allpool toodule.",
          ],
        },
        {
          heading: "Isikuandmete liigid",
          body: [
            "Kliendi kasutajate andmed: nimi, e-posti aadress, telefon, roll ja tegevuste autorsus (kes ja millal kande tegi või muutis).",
            "Käiduandmetes sisalduvad isikuandmed: tööde tegijate, vastutavate isikute ja kontaktisikute nimed ning muu teave, mille klient kirjeldustesse sisestab.",
            "Objekti vaatajate andmed: nimi, e-posti aadress ja ligipääsu andmed (objektid, kutsuja, ajad).",
            "Tehnilised andmed: sisselogimise seansid ja tõrkelogid.",
            "KAIDLY ei hoia kliendi faile; dokumentide ja fotode puhul salvestatakse ainult link.",
          ],
        },
        {
          heading: "Andmesubjektid",
          body: [
            "Kliendi töötajad ja teised kasutajad, kliendi poolt käiduandmetes nimetatud isikud ning objektide omanikud ja nende esindajad (nt korteriühistu juhatus), kellele klient annab objekti vaataja ligipääsu.",
          ],
        },
        {
          heading: "Volitatud töötleja kohustused",
          body: [
            "KAIDLY töötleb isikuandmeid ainult kliendi dokumenteeritud juhiste alusel, mille moodustavad see leping, kasutustingimused ja kliendi tegevused teenuses, välja arvatud kui õigus nõuab teisiti.",
            "KAIDLY tagab, et isikuandmeid töötlevad isikud on kohustatud hoidma konfidentsiaalsust.",
            "KAIDLY rakendab allpool kirjeldatud turvameetmeid.",
            "KAIDLY aitab klienti andmesubjekti õiguste taotlustele vastamisel ning artiklites 32–36 sätestatud kohustuste täitmisel, arvestades töötlemise laadi ja KAIDLY käsutuses olevat teavet.",
          ],
        },
        {
          heading: "Alamtöötlejad",
          body: [
            "Supabase — andmebaas ja autentimine; piirkond: {hostingRegion}.",
            "Vercel — rakenduse majutus; piirkond: {appRegion}.",
            "Resend — e-kirjade saatmine; piirkond: {emailRegion}.",
            "Klient annab üldise loa nende alamtöötlejate kasutamiseks. KAIDLY teavitab klienti kavandatavatest muudatustest alamtöötlejates ja seab alamtöötlejatele samaväärsed andmekaitsekohustused.",
          ],
        },
        {
          heading: "Turvameetmed",
          body: [
            "Ettevõtete andmed on eraldatud andmebaasi tasemel (rea tasemel turve): kasutaja näeb ainult nende ettevõtete andmeid, mille liige ta on; objekti vaataja näeb ainult talle avatud objekte ja ei saa midagi muuta.",
            "Rollipõhised õigused (omanik, administraator, käitaja, vaataja), mida kontrollitakse serveris ja andmebaasis.",
            "Kõik ühendused on krüpteeritud (HTTPS, HSTS); rakendusel on turvapäised (sh CSP ja raamimise keeld).",
            "Paroolid hoitakse autentimisteenuses ainult räsitud kujul; KAIDLY ei näe ega salvesta paroole. Seansse saab tühistada ja kontosid peatada.",
            "Käidupäevik on muutmatu: parandus lisatakse uue kandena ja algne kanne jääb alles; muudatuste ajalugu kirjutab andmebaas.",
            "KAIDLY platvormi administraatori toimingud kirjutatakse auditilogisse; administraator ei näe käidupäeviku sisu ega dokumente.",
            "Logidesse ei kirjutata paroole, võtmeid ega kutsetokeneid.",
            "Andmebaasist tehakse varukoopiaid, mida hoitakse krüpteeritult väljaspool teenust.",
          ],
        },
        {
          heading: "Isikuandmetega seotud rikkumisest teavitamine",
          body: [
            "KAIDLY teavitab klienti isikuandmetega seotud rikkumisest ilma põhjendamatu viivituseta pärast sellest teada saamist ning annab kliendile teadaoleva teabe, mida klient vajab oma kohustuste täitmiseks.",
          ],
        },
        {
          heading: "Andmete tagastamine ja kustutamine",
          body: [
            "Klient saab oma andmed lepingu kehtivuse ajal igal ajal eksportida (PDF- ja CSV-aruanded).",
            "Lepingu lõppedes kustutab või tagastab KAIDLY kliendi valikul kliendi isikuandmed, välja arvatud juhul, kui õigusaktid nõuavad nende säilitamist.",
          ],
        },
        {
          heading: "Auditiõigus",
          body: [
            "KAIDLY teeb kliendile kättesaadavaks kogu teabe, mis on vajalik selles lepingus sätestatud kohustuste täitmise tõendamiseks, ning võimaldab kliendil või tema volitatud audiitoril teha auditeid ja kontrolle ning aitab nendele kaasa.",
          ],
        },
        { heading: "Kontakt", body: ["{contactEmail}"] },
      ],
    },
  },
  en: {
    pending: "This part will be published before the service officially launches.",
    draft: {
      privacy: "Pre-launch version. The KAIDLY privacy notice will be completed before the service launches publicly.",
      terms: "Pre-launch version. The KAIDLY terms of use will be completed before the service launches publicly.",
      dpa: "Pre-launch version. The KAIDLY data processing agreement will be completed before the service launches publicly.",
    },
    updated: "Effective from",
    missing: {
      operatorName: "service operator's legal name",
      registryCode: "registry code",
      address: "address",
      privacyEmail: "privacy contact email",
      effectiveDate: "effective date",
      hostingRegion: "database region",
      appRegion: "application hosting region",
      emailRegion: "e-mail sending region",
      contactEmail: "contact email",
    },
    privacy: {
      title: "Privacy",
      intro: "How KAIDLY processes users' and organisations' data.",
      sections: [
        {
          heading: "Service operator and controller",
          body: [
            "{operatorName}, registry code {registryCode}, {address}. Privacy questions: {privacyEmail}.",
            "KAIDLY is the controller for user account data. For the data that customers (organisations) enter into KAIDLY in the course of their work, the customer is the controller and KAIDLY is the processor — see the [data processing agreement](/andmetootlusleping).",
          ],
        },
        {
          heading: "What we process",
          body: [
            "Account: name, email address, phone (if added), language and sign-in data. Passwords are stored hashed by the authentication service; KAIDLY cannot see them.",
            "Data entered by organisations: sites, electrical installations, operating-log entries, operating plan, deficiencies, links to documents and photos, and who added them when. These may contain personal data, such as the names of people who did the work or are responsible.",
            "Site viewers (e.g. the owner of a site or the board of an apartment association): name and email address, which sites they can access and who invited them.",
            "Technical data: the sign-in session and server error logs (without passwords, keys or invitation tokens).",
            "KAIDLY does not store users' files: documents and photos stay where the customer keeps them, and KAIDLY stores only the link.",
          ],
        },
        {
          heading: "Purpose",
          body: ["Data is used only to provide KAIDLY: accounts, the organisation's operating records, reminders, reports and support. It is not sold or used for advertising."],
        },
        {
          heading: "Sub-processors and data location",
          body: [
            "Supabase — database and authentication; region: {hostingRegion}.",
            "Vercel — application hosting; region: {appRegion}.",
            "Resend — sending e-mails (account confirmation, password reset, security notices and, if the user chooses, deadline reminders); region: {emailRegion}.",
            "KAIDLY uses no analytics, advertising or tracking services.",
          ],
        },
        {
          heading: "Cookies",
          body: ["KAIDLY uses only strictly necessary cookies: the sign-in session, language, the last opened organisation and the hidden getting-started guide. There are no analytics or advertising cookies."],
        },
        {
          heading: "Retention and deletion",
          body: [
            "Nothing is deleted automatically. Account deletion can be requested from the account page; account data is deleted after a manual review.",
            "Organisation records (entries, deficiencies, document links) belong to the organisation and may be needed for its legal obligations; they are kept and deleted as set out in the [data processing agreement](/andmetootlusleping).",
            "When a site viewer's access is removed, a record of who had access when and who removed it is kept.",
          ],
        },
        {
          heading: "Your rights",
          body: ["You may access and correct your data, request erasure or restriction, and receive your data in a portable form. You can lodge a complaint with the Estonian Data Protection Inspectorate."],
        },
        { heading: "Contact", body: ["{contactEmail}"] },
      ],
    },
    terms: {
      title: "Terms of use",
      intro: "The basic rules for using KAIDLY.",
      sections: [
        { heading: "Service operator", body: ["{operatorName}, registry code {registryCode}, {address}."] },
        {
          heading: "The service",
          body: ["KAIDLY is a digital operating log for electrical installations: sites, installations, operating log, operating plan, deficiencies, document links, reminders and reports."],
        },
        {
          heading: "Trial and access",
          body: [
            "A user's first organisation gets a 14-day trial with full access. Afterwards it becomes read-only: the data is kept and can be viewed and exported, but no new records can be added.",
            "Full access is activated by agreement with KAIDLY.",
          ],
        },
        {
          heading: "Your responsibility",
          body: [
            "The organisation and its users are responsible for the accuracy of the data and for meeting their legal obligations (including those for operating electrical installations). KAIDLY is a tool and does not replace a competent person's judgement.",
            "Accounts must not be shared and the service must not be abused.",
          ],
        },
        {
          heading: "Processing of personal data",
          body: [
            "For the personal data the customer enters into KAIDLY, the customer is the controller and KAIDLY is the processor. The terms of processing are set out in the [data processing agreement](/andmetootlusleping), which forms part of these terms.",
          ],
        },
        { heading: "Availability", body: ["The service is provided with due care; maintenance and interruptions are announced in advance where possible."] },
        { heading: "Contact", body: ["{contactEmail}"] },
      ],
    },
    dpa: {
      title: "Data processing agreement",
      intro: "The terms under which KAIDLY processes personal data on behalf of the customer (Article 28 of the General Data Protection Regulation).",
      sections: [
        {
          heading: "Parties",
          body: [
            "The controller is the customer — the organisation that uses KAIDLY. The processor is {operatorName}, registry code {registryCode}, {address}.",
            "This agreement forms part of the [terms of use](/kasutustingimused).",
          ],
        },
        {
          heading: "Subject matter, nature, purpose and duration",
          body: [
            "Subject matter and purpose: providing the KAIDLY service — keeping the operating records of electrical installations (sites, installations, operating log, operating plan, deficiencies, document links), reminders, reports and support.",
            "Nature: storing, displaying and searching data, producing reports and sending reminders.",
            "Duration: for as long as the customer uses the service and afterwards until the data is returned or deleted as set out below.",
          ],
        },
        {
          heading: "Types of personal data",
          body: [
            "Data of the customer's users: name, email address, phone, role and authorship of actions (who made or changed an entry and when).",
            "Personal data within the operating records: names of people who did the work, responsible persons and contacts, and any other information the customer enters in descriptions.",
            "Data of site viewers: name, email address and access data (sites, inviter, times).",
            "Technical data: sign-in sessions and error logs.",
            "KAIDLY does not store the customer's files; for documents and photos only a link is stored.",
          ],
        },
        {
          heading: "Data subjects",
          body: [
            "The customer's employees and other users, people named by the customer in the operating records, and owners of sites and their representatives (e.g. the board of an apartment association) to whom the customer gives site viewer access.",
          ],
        },
        {
          heading: "Processor's obligations",
          body: [
            "KAIDLY processes personal data only on the customer's documented instructions, which consist of this agreement, the terms of use and the customer's actions in the service, unless the law requires otherwise.",
            "KAIDLY ensures that persons processing personal data are bound by confidentiality.",
            "KAIDLY applies the security measures described below.",
            "KAIDLY assists the customer in responding to data subjects' requests and in meeting the obligations under Articles 32–36, taking into account the nature of the processing and the information available to KAIDLY.",
          ],
        },
        {
          heading: "Sub-processors",
          body: [
            "Supabase — database and authentication; region: {hostingRegion}.",
            "Vercel — application hosting; region: {appRegion}.",
            "Resend — sending e-mails; region: {emailRegion}.",
            "The customer gives general authorisation to use these sub-processors. KAIDLY informs the customer of intended changes to sub-processors and imposes equivalent data protection obligations on them.",
          ],
        },
        {
          heading: "Security measures",
          body: [
            "Organisations' data is separated at database level (row-level security): a user sees only the data of organisations they belong to; a site viewer sees only the sites opened to them and cannot change anything.",
            "Role-based permissions (owner, admin, operator, viewer), checked on the server and in the database.",
            "All connections are encrypted (HTTPS, HSTS); the application sends security headers (including CSP and a ban on framing).",
            "Passwords are kept only in hashed form by the authentication service; KAIDLY never sees or stores passwords. Sessions can be revoked and accounts suspended.",
            "The operating log is immutable: a correction is added as a new entry and the original stays; the change history is written by the database.",
            "Actions of KAIDLY platform administrators are written to an audit log; administrators do not see operating-log content or documents.",
            "Passwords, keys and invitation tokens are not written to logs.",
            "Database backups are taken and kept encrypted outside the service.",
          ],
        },
        {
          heading: "Personal data breach notification",
          body: [
            "KAIDLY notifies the customer of a personal data breach without undue delay after becoming aware of it and provides the information known to it that the customer needs to meet its obligations.",
          ],
        },
        {
          heading: "Return and deletion of data",
          body: [
            "The customer can export its data at any time while the agreement is in force (PDF and CSV reports).",
            "When the agreement ends, KAIDLY deletes or returns the customer's personal data at the customer's choice, unless the law requires it to be kept.",
          ],
        },
        {
          heading: "Audit rights",
          body: [
            "KAIDLY makes available to the customer all information necessary to demonstrate compliance with the obligations in this agreement and allows for and contributes to audits and inspections by the customer or an auditor mandated by it.",
          ],
        },
        { heading: "Contact", body: ["{contactEmail}"] },
      ],
    },
  },
  ru: {
    pending: "Эта часть будет опубликована до официального запуска сервиса.",
    draft: {
      privacy: "Предварительная версия. Политика конфиденциальности KAIDLY будет дополнена до публичного запуска сервиса.",
      terms: "Предварительная версия. Условия использования KAIDLY будут дополнены до публичного запуска сервиса.",
      dpa: "Предварительная версия. Договор об обработке данных KAIDLY будет дополнен до публичного запуска сервиса.",
    },
    updated: "Действует с",
    missing: {
      operatorName: "наименование поставщика услуги",
      registryCode: "регистрационный код",
      address: "адрес",
      privacyEmail: "e-mail по вопросам конфиденциальности",
      effectiveDate: "дата вступления в силу",
      hostingRegion: "регион базы данных",
      appRegion: "регион размещения приложения",
      emailRegion: "регион отправки e-mail",
      contactEmail: "контактный e-mail",
    },
    privacy: {
      title: "Конфиденциальность",
      intro: "Как KAIDLY обрабатывает данные пользователей и организаций.",
      sections: [
        {
          heading: "Поставщик услуги и ответственный обработчик",
          body: [
            "{operatorName}, регистрационный код {registryCode}, {address}. Вопросы конфиденциальности: {privacyEmail}.",
            "KAIDLY является ответственным обработчиком данных учётных записей пользователей. В отношении данных, которые клиенты (организации) вводят в KAIDLY в ходе своей работы, ответственным обработчиком является клиент, а KAIDLY — уполномоченным обработчиком — см. [договор об обработке данных](/andmetootlusleping).",
          ],
        },
        {
          heading: "Какие данные мы обрабатываем",
          body: [
            "Учётная запись: имя, e-mail, телефон (если указан), язык и данные входа. Пароли хранятся службой аутентификации в виде хеша; KAIDLY их не видит.",
            "Данные, которые вводят организации: объекты, электроустановки, записи оперативного журнала, план эксплуатации, дефекты, ссылки на документы и фотографии, а также кто и когда их добавил. Они могут содержать персональные данные, например имена исполнителей работ и ответственных лиц.",
            "Наблюдатели объекта (например, владелец объекта или правление квартирного товарищества): имя и e-mail, к каким объектам у них есть доступ и кто их пригласил.",
            "Технические данные: сеанс входа и журналы ошибок сервера (без паролей, ключей и токенов приглашений).",
            "KAIDLY не хранит файлы пользователей: документы и фотографии остаются там, где их хранит клиент, а KAIDLY сохраняет только ссылку.",
          ],
        },
        {
          heading: "Цель",
          body: ["Данные используются только для работы KAIDLY: учётные записи, эксплуатационные записи организации, напоминания, отчёты и поддержка. Данные не продаются и не используются для рекламы."],
        },
        {
          heading: "Субобработчики и местонахождение данных",
          body: [
            "Supabase — база данных и аутентификация; регион: {hostingRegion}.",
            "Vercel — размещение приложения; регион: {appRegion}.",
            "Resend — отправка e-mail (подтверждение учётной записи, сброс пароля, уведомления безопасности и, по желанию пользователя, напоминания о сроках); регион: {emailRegion}.",
            "KAIDLY не использует сервисы аналитики, рекламы или отслеживания.",
          ],
        },
        {
          heading: "Файлы cookie",
          body: ["KAIDLY использует только необходимые cookie: сеанс входа, язык, последняя открытая организация и скрытое руководство по началу работы. Аналитических и рекламных cookie нет."],
        },
        {
          heading: "Хранение и удаление",
          body: [
            "Ничего не удаляется автоматически. Удаление учётной записи можно запросить на странице учётной записи; данные учётной записи удаляются после ручной проверки.",
            "Эксплуатационные записи организации (записи, дефекты, ссылки на документы) принадлежат организации и могут быть нужны для выполнения её юридических обязанностей; они хранятся и удаляются согласно [договору об обработке данных](/andmetootlusleping).",
            "При отзыве доступа наблюдателя объекта сохраняется отметка о том, кто и когда имел доступ и кто его отозвал.",
          ],
        },
        {
          heading: "Ваши права",
          body: ["Вы можете ознакомиться со своими данными, исправить их, запросить удаление или ограничение обработки и получить данные в переносимом виде. Жалобу можно подать в Инспекцию по защите данных Эстонии."],
        },
        { heading: "Контакт", body: ["{contactEmail}"] },
      ],
    },
    terms: {
      title: "Условия использования",
      intro: "Основные правила использования KAIDLY.",
      sections: [
        { heading: "Поставщик услуги", body: ["{operatorName}, регистрационный код {registryCode}, {address}."] },
        {
          heading: "Услуга",
          body: ["KAIDLY — цифровой оперативный журнал для электроустановок: объекты, электроустановки, оперативный журнал, план эксплуатации, дефекты, ссылки на документы, напоминания и отчёты."],
        },
        {
          heading: "Пробный период и доступ",
          body: [
            "Первая организация пользователя получает 14-дневный пробный период с полным доступом. Затем организация доступна только для просмотра: данные сохраняются, их можно просматривать и экспортировать, но новые записи добавлять нельзя.",
            "Полный доступ активируется по договорённости с KAIDLY.",
          ],
        },
        {
          heading: "Ответственность пользователя",
          body: [
            "Организация и её пользователи отвечают за точность данных и выполнение своих юридических обязанностей (в том числе по эксплуатации электроустановок). KAIDLY — инструмент и не заменяет оценку компетентного лица.",
            "Нельзя передавать учётную запись другим или злоупотреблять услугой.",
          ],
        },
        {
          heading: "Обработка персональных данных",
          body: [
            "В отношении персональных данных, которые клиент вводит в KAIDLY, клиент является ответственным обработчиком, а KAIDLY — уполномоченным обработчиком. Условия обработки изложены в [договоре об обработке данных](/andmetootlusleping), который является частью настоящих условий.",
          ],
        },
        { heading: "Доступность", body: ["Услуга предоставляется с должной заботой; о плановых работах и перерывах по возможности сообщается заранее."] },
        { heading: "Контакт", body: ["{contactEmail}"] },
      ],
    },
    dpa: {
      title: "Договор об обработке данных",
      intro: "Условия, на которых KAIDLY обрабатывает персональные данные от имени клиента (статья 28 Общего регламента по защите данных).",
      sections: [
        {
          heading: "Стороны",
          body: [
            "Ответственный обработчик — клиент, организация, которая использует KAIDLY. Уполномоченный обработчик — {operatorName}, регистрационный код {registryCode}, {address}.",
            "Настоящий договор является частью [условий использования](/kasutustingimused).",
          ],
        },
        {
          heading: "Предмет, характер, цель и срок обработки",
          body: [
            "Предмет и цель: оказание услуги KAIDLY — ведение эксплуатационных данных электроустановок (объекты, электроустановки, оперативный журнал, план эксплуатации, дефекты, ссылки на документы), напоминания, отчёты и поддержка.",
            "Характер: хранение, отображение и поиск данных, составление отчётов и отправка напоминаний.",
            "Срок: всё время, пока клиент пользуется услугой, и после этого до возврата или удаления данных, как указано ниже.",
          ],
        },
        {
          heading: "Категории персональных данных",
          body: [
            "Данные пользователей клиента: имя, e-mail, телефон, роль и авторство действий (кто и когда сделал или изменил запись).",
            "Персональные данные в эксплуатационных записях: имена исполнителей работ, ответственных и контактных лиц, а также иная информация, которую клиент вводит в описания.",
            "Данные наблюдателей объекта: имя, e-mail и данные доступа (объекты, пригласивший, время).",
            "Технические данные: сеансы входа и журналы ошибок.",
            "KAIDLY не хранит файлы клиента; для документов и фотографий сохраняется только ссылка.",
          ],
        },
        {
          heading: "Субъекты данных",
          body: [
            "Работники клиента и другие пользователи, лица, названные клиентом в эксплуатационных записях, а также владельцы объектов и их представители (например, правление квартирного товарищества), которым клиент предоставляет доступ наблюдателя объекта.",
          ],
        },
        {
          heading: "Обязанности уполномоченного обработчика",
          body: [
            "KAIDLY обрабатывает персональные данные только по документированным указаниям клиента, которыми являются настоящий договор, условия использования и действия клиента в сервисе, если законом не предусмотрено иное.",
            "KAIDLY обеспечивает, чтобы лица, обрабатывающие персональные данные, были обязаны соблюдать конфиденциальность.",
            "KAIDLY применяет меры безопасности, описанные ниже.",
            "KAIDLY помогает клиенту отвечать на запросы субъектов данных и выполнять обязанности по статьям 32–36 с учётом характера обработки и доступной KAIDLY информации.",
          ],
        },
        {
          heading: "Субобработчики",
          body: [
            "Supabase — база данных и аутентификация; регион: {hostingRegion}.",
            "Vercel — размещение приложения; регион: {appRegion}.",
            "Resend — отправка e-mail; регион: {emailRegion}.",
            "Клиент даёт общее разрешение на использование этих субобработчиков. KAIDLY сообщает клиенту о планируемых изменениях субобработчиков и возлагает на них равнозначные обязанности по защите данных.",
          ],
        },
        {
          heading: "Меры безопасности",
          body: [
            "Данные организаций разделены на уровне базы данных (безопасность на уровне строк): пользователь видит только данные организаций, в которых он состоит; наблюдатель объекта видит только открытые ему объекты и ничего не может изменять.",
            "Права на основе ролей (владелец, администратор, оператор, наблюдатель), которые проверяются на сервере и в базе данных.",
            "Все соединения зашифрованы (HTTPS, HSTS); приложение отправляет заголовки безопасности (в том числе CSP и запрет встраивания).",
            "Пароли хранятся службой аутентификации только в виде хеша; KAIDLY никогда не видит и не хранит пароли. Сеансы можно отозвать, а учётные записи приостановить.",
            "Оперативный журнал неизменяем: исправление добавляется новой записью, исходная запись сохраняется; историю изменений ведёт база данных.",
            "Действия администраторов платформы KAIDLY записываются в журнал аудита; администраторы не видят содержание оперативного журнала и документы.",
            "Пароли, ключи и токены приглашений не записываются в журналы.",
            "Создаются резервные копии базы данных, которые хранятся в зашифрованном виде вне сервиса.",
          ],
        },
        {
          heading: "Уведомление о нарушении защиты персональных данных",
          body: [
            "KAIDLY уведомляет клиента о нарушении защиты персональных данных без неоправданной задержки после того, как ему стало о нём известно, и предоставляет известную ему информацию, необходимую клиенту для выполнения своих обязанностей.",
          ],
        },
        {
          heading: "Возврат и удаление данных",
          body: [
            "Во время действия договора клиент может в любое время экспортировать свои данные (отчёты PDF и CSV).",
            "По окончании договора KAIDLY по выбору клиента удаляет или возвращает персональные данные клиента, если законодательство не требует их хранения.",
          ],
        },
        {
          heading: "Право на аудит",
          body: [
            "KAIDLY предоставляет клиенту всю информацию, необходимую для подтверждения выполнения обязанностей по настоящему договору, и допускает аудиты и проверки, проводимые клиентом или уполномоченным им аудитором, а также содействует им.",
          ],
        },
        { heading: "Контакт", body: ["{contactEmail}"] },
      ],
    },
  },
};
