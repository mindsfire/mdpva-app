/**
 * Bilingual strings for the public onboarding screens.
 *
 * Every label carries both languages inline rather than behind a toggle: the
 * members filling this in range from fully English-comfortable to Kannada-only,
 * and a toggle set to the wrong language leaves someone stranded on a form they
 * can't read. The admin app stays English — staff are a known, small group.
 *
 * ⚠️ The Kannada strings below are unreviewed. They must be checked by a native
 * speaker before this ships, and the association's own name in particular must
 * match however MDPVA officially writes it.
 */

export interface Bilingual {
  en: string;
  kn: string;
}

const t = (en: string, kn: string): Bilingual => ({ en, kn });

/**
 * The seal (src/assets/brand/mdpva-logo.png) is ~25 years old and spells the
 * city "Mysore"; "Mysuru" is the corrected official name and is what we use
 * everywhere in text. The logo image keeps its historical spelling.
 *
 * The seal's Kannada is a *transliteration* of the English
 * ("ಫೋಟೋಗ್ರಾಫರ್ ಅಂಡ್ ವೀಡಿಯೋಗ್ರಾಫರ್"), not a translation — an earlier draft of
 * this file used the translated ಛಾಯಾಗ್ರಾಹಕರ, which doesn't match the
 * registered name. `nameKn` follows the seal.
 *
 * ⚠️ Still worth one native-speaker check before rollout: this is my reading
 * of a circular seal, and it's the association's name on a form members sign.
 */
export const ORG = {
  nameEn: "Mysuru District Photographers & Videographers Association (R.)",
  nameKn: "ಮೈಸೂರು ಜಿಲ್ಲಾ ಫೋಟೋಗ್ರಾಫರ್ ಅಂಡ್ ವೀಡಿಯೋಗ್ರಾಫರ್ ಅಸೋಸಿಯೇಷನ್ (ರಿ)",
  place: "Mysuru, Karnataka",
} as const;

export const STRINGS = {
  // Verify step
  verifyTitle: t("Member details form", "ಸದಸ್ಯರ ವಿವರಗಳ ನಮೂನೆ"),
  verifyIntro: t(
    "Enter your membership number and the phone number MDPVA has on record for you.",
    "ನಿಮ್ಮ ಸದಸ್ಯತ್ವ ಸಂಖ್ಯೆ ಮತ್ತು ಸಂಘದಲ್ಲಿ ದಾಖಲಾಗಿರುವ ದೂರವಾಣಿ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ.",
  ),
  membershipNo: t("Membership number", "ಸದಸ್ಯತ್ವ ಸಂಖ್ಯೆ"),
  membershipHint: t(
    "The number printed on your MDPVA card.",
    "ನಿಮ್ಮ ಎಂಡಿಪಿವಿಎ ಕಾರ್ಡ್‌ನಲ್ಲಿ ಮುದ್ರಿತವಾದ ಸಂಖ್ಯೆ.",
  ),
  continue: t("Continue", "ಮುಂದುವರಿಸಿ"),
  foundYou: t("Is this you?", "ಇದು ನೀವೇನಾ?"),
  yesContinue: t("Yes, continue", "ಹೌದು, ಮುಂದುವರಿಸಿ"),
  noGoBack: t("No, go back", "ಇಲ್ಲ, ಹಿಂದೆ ಹೋಗಿ"),

  // Generic, non-enumerating failure — identical for "no such number" and
  // "wrong phone", so the form never confirms which numbers exist.
  verifyFailed: t(
    "We couldn't find that membership number and phone together. If your details aren't in our records yet, please contact the MDPVA office.",
    "ಆ ಸದಸ್ಯತ್ವ ಸಂಖ್ಯೆ ಮತ್ತು ದೂರವಾಣಿ ಸಂಖ್ಯೆ ಹೊಂದಿಕೆಯಾಗಲಿಲ್ಲ. ನಿಮ್ಮ ವಿವರಗಳು ಇನ್ನೂ ದಾಖಲಾಗಿಲ್ಲದಿದ್ದರೆ, ದಯವಿಟ್ಟು ಸಂಘದ ಕಚೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.",
  ),
  rateLimited: t(
    "Too many attempts. Please wait a few minutes and try again.",
    "ಹಲವು ಬಾರಿ ಪ್ರಯತ್ನಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಕೆಲವು ನಿಮಿಷಗಳ ನಂತರ ಪ್ರಯತ್ನಿಸಿ.",
  ),

  // Form sections
  sectionPhoto: t("Photograph", "ಭಾವಚಿತ್ರ"),
  sectionNameContact: t("Name & contact", "ಹೆಸರು ಮತ್ತು ಸಂಪರ್ಕ"),
  sectionAddress: t("Address", "ವಿಳಾಸ"),
  sectionWork: t("Work & personal", "ವೃತ್ತಿ ಮತ್ತು ವೈಯಕ್ತಿಕ"),

  // Fields
  firstName: t("First name", "ಮೊದಲ ಹೆಸರು"),
  lastName: t("Last name", "ಕೊನೆಯ ಹೆಸರು"),
  phone: t("Phone", "ದೂರವಾಣಿ"),
  email: t("Email", "ಇಮೇಲ್"),
  addressLine1: t("Address line 1", "ವಿಳಾಸ ಸಾಲು ೧"),
  addressLine2: t("Address line 2", "ವಿಳಾಸ ಸಾಲು ೨"),
  area: t("Area", "ಪ್ರದೇಶ"),
  pincode: t("Pincode", "ಪಿನ್ ಕೋಡ್"),
  city: t("City", "ನಗರ"),
  state: t("State", "ರಾಜ್ಯ"),
  profession: t("Nature of work", "ವೃತ್ತಿ"),
  businessName: t("Studio / business name", "ವ್ಯವಹಾರದ ಹೆಸರು"),
  dob: t("Date of birth", "ಜನ್ಮ ದಿನಾಂಕ"),
  bloodGroup: t("Blood group", "ರಕ್ತದ ಗುಂಪು"),

  photographer: t("Photographer", "ಛಾಯಾಗ್ರಾಹಕ"),
  videographer: t("Videographer", "ವೀಡಿಯೋಗ್ರಾಹಕ"),
  both: t("Both", "ಎರಡೂ"),

  optional: t("Optional", "ಐಚ್ಛಿಕ"),
  choosePhoto: t("Choose photo", "ಭಾವಚಿತ್ರ ಆಯ್ಕೆಮಾಡಿ"),
  replacePhoto: t("Replace photo", "ಭಾವಚಿತ್ರ ಬದಲಾಯಿಸಿ"),
  adjustCrop: t("Adjust crop", "ಕತ್ತರಿಸುವಿಕೆ ಸರಿಪಡಿಸಿ"),
  photoHint: t(
    "A clear photo of your face, looking at the camera. You can move and zoom it to fit the frame.",
    "ಕ್ಯಾಮೆರಾ ನೋಡುತ್ತಿರುವ ನಿಮ್ಮ ಮುಖದ ಸ್ಪಷ್ಟ ಚಿತ್ರ. ಚೌಕಟ್ಟಿಗೆ ಸರಿಹೊಂದಿಸಲು ಸರಿಸಬಹುದು.",
  ),
  noPhotoYet: t("No photo yet", "ಇನ್ನೂ ಚಿತ್ರವಿಲ್ಲ"),

  draftSaved: t(
    "Saved on this device — you can close this page and come back.",
    "ಈ ಸಾಧನದಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ. ಪುಟ ಮುಚ್ಚಿ ನಂತರ ಮರಳಬಹುದು.",
  ),
  clearDraft: t("Clear saved draft", "ಉಳಿಸಿದ ಕರಡು ಅಳಿಸಿ"),
  notYou: t("Not you? Start over", "ನೀವಲ್ಲವೇ? ಮತ್ತೆ ಪ್ರಾರಂಭಿಸಿ"),
  submit: t("Submit for approval", "ಅನುಮೋದನೆಗೆ ಸಲ್ಲಿಸಿ"),
  preview: t("Preview", "ಮುನ್ನೋಟ"),
  yourDetails: t("Your details", "ನಿಮ್ಮ ವಿವರಗಳು"),
  livePreview: t("Live preview", "ನೇರ ಮುನ್ನೋಟ"),

  consent: t(
    "I declare that the particulars given above are true to the best of my knowledge, and I consent to MDPVA storing them and showing them in the association's member directory.",
    "ಮೇಲಿನ ವಿವರಗಳು ನನ್ನ ಅರಿವಿನ ಮಟ್ಟಿಗೆ ಸತ್ಯವೆಂದು ಘೋಷಿಸುತ್ತೇನೆ.",
  ),

  // Sheet furniture
  sheetTitle: t("Member details form", "ಸದಸ್ಯರ ವಿವರಗಳ ನಮೂನೆ"),
  affixPhoto: t(
    "Affix recent passport size photograph",
    "ಇತ್ತೀಚಿನ ಪಾಸ್‌ಪೋರ್ಟ್ ಅಳತೆಯ ಭಾವಚಿತ್ರ",
  ),
  signature: t("Signature", "ಸಹಿ"),
  date: t("Date", "ದಿನಾಂಕ"),
  officeUse: t("For office use", "ಕಚೇರಿ ಬಳಕೆಗೆ"),
} as const;
