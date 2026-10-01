/**
 * Estonian UI strings. Every user-facing string lives here so another language can be
 * added later as a second dictionary with the same shape (see `Messages` in ./index.ts).
 */
export const et = {
  brand: {
    name: "KAIDLY",
    tagline: "Elektripaigaldise käit. Lihtsalt.",
    descriptor: "Digitaalne käidupäevik elektripaigaldistele",
  },
  meta: {
    description:
      "KAIDLY on digitaalne käidupäevik elektripaigaldistele: käidupäevik, käidukava, puudused ja dokumendid ühes kohas.",
  },
  common: {
    loading: "Laen…",
    signIn: "Logi sisse",
    signUp: "Loo konto",
    signOut: "Logi välja",
    email: "E-post",
    password: "Parool",
    fullName: "Nimi",
    backToLogin: "Tagasi sisselogimisele",
    account: "Konto",
    menu: "Menüü",
    more: "Rohkem",
  },
  landing: {
    lead:
      "Käidupäevik, käidukava, puudused ja dokumendid ühes kohas — tehtud inimestele, kes hoiavad elektripaigaldised töös.",
    points: [
      "Sissekanne objektil telefonist alla minutiga",
      "Käidukava tähtajad ja puudused alati näha",
      "Kõik dokumendid paigaldise juures",
    ],
  },
  auth: {
    login: {
      title: "Logi sisse",
      description: "Sisesta oma e-post ja parool.",
      submit: "Logi sisse",
      submitting: "Login sisse…",
      forgot: "Unustasid parooli?",
      noAccount: "Pole veel kontot?",
    },
    signUp: {
      title: "Loo konto",
      description: "Konto loomiseks sisesta oma nimi, e-post ja parool.",
      repeatPassword: "Korda parooli",
      passwordHint: "Vähemalt 10 tähemärki.",
      submit: "Loo konto",
      submitting: "Loon kontot…",
      haveAccount: "Konto on juba olemas?",
      passwordsDoNotMatch: "Paroolid ei kattu.",
    },
    signUpSuccess: {
      title: "Kontrolli oma e-posti",
      description:
        "Saatsime sulle kinnituslingi. Ava see samas brauseris, et konto kinnitada ja sisse logida.",
    },
    forgot: {
      title: "Parooli taastamine",
      description: "Sisesta oma e-post ja saadame sulle lingi uue parooli määramiseks.",
      submit: "Saada link",
      submitting: "Saadan…",
      sentTitle: "Kontrolli oma e-posti",
      sentDescription:
        "Kui selle aadressiga konto on olemas, saatsime sinna lingi uue parooli määramiseks.",
    },
    updatePassword: {
      title: "Uus parool",
      description: "Sisesta oma uus parool.",
      newPassword: "Uus parool",
      submit: "Salvesta parool",
      submitting: "Salvestan…",
    },
    error: {
      title: "Midagi läks valesti",
    },
  },
  /** Safe, application-controlled messages. Keys are the only thing that travels in URLs. */
  errors: {
    link_invalid: "See link ei ole kehtiv. Küsi uus link või logi sisse.",
    link_expired: "Link on aegunud. Küsi uus link.",
    link_other_browser:
      "Ava link samas brauseris ja seadmes, kus konto lõid või parooli taastamist alustasid. E-post võib olla juba kinnitatud — proovi sisse logida.",
    session_required: "Selle lehe nägemiseks logi sisse.",
    invalid_credentials: "Vale e-post või parool.",
    email_not_confirmed: "E-post on kinnitamata. Ava kinnituslink, mille sulle saatsime.",
    user_already_exists: "Selle e-postiga konto on juba olemas.",
    weak_password: "Parool on liiga nõrk. Kasuta vähemalt 10 tähemärki.",
    same_password: "Uus parool peab erinema praegusest.",
    rate_limited: "Liiga palju katseid. Oota veidi ja proovi uuesti.",
    network: "Ühendus katkes. Kontrolli internetiühendust ja proovi uuesti.",
    unknown: "Midagi läks valesti. Proovi uuesti.",
  },
  app: {
    nav: {
      overview: "Ülevaade",
      sites: "Objektid",
      log: "Käidupäevik",
      schedule: "Käidukava",
      deficiencies: "Puudused",
      documents: "Dokumendid",
      settings: "Seaded",
    },
    addEntry: "Lisa sissekanne",
    organisations: {
      title: "Organisatsioonid",
      emptyTitle: "Organisatsiooni veel pole",
      emptyBody: "Organisatsiooni loomine ja liikmete kutsumine tulevad järgmises arendusetapis.",
    },
    signedInAs: "Sisse logitud kui",
    navUnavailable: "Saadaval pärast organisatsiooni valimist",
  },
  config: {
    title: "Rakendus ei ole seadistatud",
    body: "Teenus on ajutiselt kättesaamatu. Proovi hiljem uuesti.",
  },
} as const;
