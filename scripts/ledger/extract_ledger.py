#!/usr/bin/env python3
"""Extract the legacy paper-ledger .docx exports into the app's member CSV.

One-shot migration tool for the 1360-slot ledger the association kept in Word.
Stdlib only and Python rather than TypeScript on purpose: a .docx is a zip of
XML, so this needs no dependencies at all, and it runs once.

Outputs, all under the (gitignored) output directory:
  members.csv     - matches CSV_HEADERS in src/lib/csv/member-csv.ts exactly,
                    so it feeds the existing admin import and its dry-run.
  photos/<id>.jpg - one per row that had an embedded photo, named by ledger no.
  report.txt      - per-row warnings for anything inferred or dropped.

Usage:
  python3 scripts/ledger/extract_ledger.py OUT_DIR FILE.docx [FILE.docx ...]
"""

import csv
import os
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

CSV_HEADERS = [
    "first_name", "last_name", "email", "phone", "legacy_id", "profession",
    "business_name", "address_line1", "address_line2", "area", "city", "state",
    "pincode", "dob", "blood_group", "status", "fees_paid_upto",
    "death_fund_covered", "notes",
]

# Trade words that mark a line as the member's studio rather than their address.
BUSINESS_WORDS = (
    "studio", "video", "photo", "colour", "color", "lab", "digital",
    "creations", "enterprises", "images", "arts", "graphics", "movie",
    "cinema", "click", "frames", "album",
)
VIDEO_WORDS = ("video", "movie", "cinema", "cine")
PHOTO_WORDS = ("photo", "studio", "images", "click", "frames", "album", "lab")


def cell_text(tc):
    lines = []
    for p in tc.iter(W + "p"):
        lines.append("".join(t.text or "" for t in p.iter(W + "t")).strip())
    return [ln for ln in lines if ln]


def cell_images(tc):
    return [b.get(R + "embed") for b in tc.iter(A + "blip")]


def read_rows(path):
    """Yield (ledger_no, [cell lines], [image zip paths]) per data row."""
    z = zipfile.ZipFile(path)
    doc = ET.fromstring(z.read("word/document.xml"))
    rels = {
        r.get("Id"): r.get("Target")
        for r in ET.fromstring(z.read("word/_rels/document.xml.rels"))
    }
    for tbl in doc.iter(W + "tbl"):
        for tr in [x for x in tbl if x.tag == W + "tr"]:
            cells = [c for c in tr if c.tag == W + "tc"]
            if len(cells) < 7:
                continue
            texts = [cell_text(c) for c in cells]
            first = " ".join(texts[0]) if texts[0] else ""
            if not re.fullmatch(r"0*\d+", first.strip()):
                continue  # header row
            imgs = [rels.get(i) for i in cell_images(cells[6])]
            yield int(first), texts, [i for i in imgs if i], z


def parse_phones(lines):
    """Return (primary_mobile, [other numbers]).

    Members verify themselves at onboarding by typing a phone number, so the
    primary must be a mobile; shop landlines would silently lock them out.
    """
    nums = []
    for ln in lines:
        for tok in re.split(r"[,/;]| and ", ln):
            digits = re.sub(r"\D", "", tok)
            if digits:
                nums.append(digits)
    mobiles = []
    others = []
    for n in nums:
        core = n[-10:] if len(n) > 10 and n.startswith(("0", "91")) else n
        if len(core) == 10 and core[0] in "6789":
            mobiles.append(core)
        else:
            others.append(n)
    primary = mobiles[0] if mobiles else None
    rest = mobiles[1:] + others
    return primary, rest


MONTHS = {}


def parse_dob(lines):
    """Normalise the 12 date spellings in the ledger to YYYY-MM-DD."""
    if not lines:
        return None, None
    raw = " ".join(lines).strip()
    s = re.sub(r"[.—/+\s]+", "-", raw).strip("-")
    m = re.fullmatch(r"(\d{1,2})-(\d{1,2})-(\d{2,5})", s)
    if not m:
        if re.fullmatch(r"(19|20)\d{2}", s):
            return None, f"year-only DOB {raw!r} dropped"
        # e.g. 03-081976 : separator missing between month and year
        m2 = re.fullmatch(r"(\d{1,2})-(\d{2})(\d{4})", s)
        if not m2:
            return None, f"unparseable DOB {raw!r} dropped"
        m = m2
    d, mo, y = int(m.group(1)), int(m.group(2)), m.group(3)
    if len(y) == 2:
        y = int(y)
        y = 2000 + y if y < 25 else 1900 + y
    elif len(y) > 4:
        return None, f"unparseable DOB {raw!r} dropped"
    else:
        y = int(y)
    warn = None
    if mo > 12 and d <= 12:
        d, mo = mo, d  # written month-first
        warn = f"DOB {raw!r} read as month-first"
    if not (1 <= mo <= 12 and 1 <= d <= 31 and 1900 <= y <= 2020):
        return None, f"out-of-range DOB {raw!r} dropped"
    return f"{y:04d}-{mo:02d}-{d:02d}", warn


def parse_blood_group(lines):
    """Normalise the blood group cell.

    The ledger was typed by many hands over decades: 'O' is often the digit 0,
    minus is sometimes an en dash, and the trailing 've' of '+ve' is optional.
    A bare group with no Rh sign is kept as-is - partial, but true.
    """
    if not lines:
        return None, None
    raw = " ".join(lines)
    s = raw.upper()
    s = s.replace("–", "-").replace("—", "-")  # en/em dash
    s = re.sub(r"NEGATIVE", "-", s)
    s = re.sub(r"POSITIVE", "+", s)
    s = re.sub(r"[.,\s]", "", s)
    s = s.replace("0", "O")
    if s in ("", "-", "--"):
        return None, None  # the cell was simply left empty
    # Anything trailing the sign is a spelling of "ve" ('+ve', '-Ne', '+V',
    # '+p'); only the group and the sign carry meaning. 'OB+ve' is genuinely
    # ambiguous between O and B, so it deliberately fails to match here.
    m = re.fullmatch(r"(AB|A|B|O)\s*([+-])?[A-Z]{0,2}", s)
    if not m:
        return None, f"unrecognised blood group {raw!r} moved to notes"
    return m.group(1) + (m.group(2) or ""), None


SMART_QUOTES = {"“": "", "”": "", "‘": "'", "’": "'"}


def desmarten(text):
    for a, b in SMART_QUOTES.items():
        text = text.replace(a, b)
    return text


def clean_name(raw):
    """Return (name, alias, parentage) from a ledger name line.

    Many entries carry a nickname the trade knows the member by - 'K.PRAKASH
    (COLPAY)' - and a few carry parentage that belongs on its own line. Both
    are preserved in notes rather than crammed into the name column, which the
    app validates as letters/spaces/. ' - only.
    """
    text = desmarten(raw).strip().strip(",")
    parentage = None
    m = re.search(r"\b((?:s|d|w)\s*[/.]?\s*o\b.*)$", text, re.I)
    if m:
        parentage = m.group(1).strip()
        text = text[: m.start()].strip()
    alias = None
    m = re.search(r"[(\[]([^)\]]+)[)\]]", text)
    if m:
        alias = m.group(1).strip()
        text = (text[: m.start()] + " " + text[m.end():]).strip()
    # Anything left that the name column rejects (digits, #, &) is not a name.
    text = re.sub(r"[^A-Za-z .'\-]", " ", text)
    text = re.sub(r"\s{2,}", " ", text).strip(" .-'") or raw.strip()
    return text, alias, parentage


def clean_business(raw):
    """Return (business_name, original_if_lossy).

    A handful of rows run the studio name and its address together on one line.
    The name column only accepts letters, digits and . , ' & -, so the rest is
    stripped here and the untouched line is kept in notes.
    """
    text = desmarten(raw).strip().strip("\",.'").strip()
    cleaned = re.sub(r"[^A-Za-z0-9 .,'&\-]", " ", text)
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip(" .,-")
    lossy = text if re.sub(r"\s+", "", cleaned) != re.sub(r"\s+", "", text) else None
    if len(cleaned) > 120:  # MAX_LENGTHS.businessName
        cleaned = cleaned[:120].rsplit(" ", 1)[0]
        lossy = text
    return (cleaned or None), lossy


def is_business(line):
    low = line.lower()
    if line.startswith(("“", '"')):
        return True
    return any(w in low for w in BUSINESS_WORDS)


def profession_for(business):
    if not business:
        return None
    low = business.lower()
    v = any(w in low for w in VIDEO_WORDS)
    p = any(w in low for w in PHOTO_WORDS)
    if v and p:
        return "both"
    if v:
        return "videographer"
    if p:
        return "photographer"
    return None


# Trailing 'Pin No. 571124.' / '- 570008' / ' 24' - the label and any closing
# punctuation are noise; the digits are the postcode.
CITY_RE = re.compile(
    r"^(.*?)[\s,;\-]*(?:PIN\s*(?:NO)?\.?\s*[:\-]?\s*)?(\d{6}|\d{1,3})\s*[.,]?\s*$",
    re.I,
)

# The ledger spells the city a dozen ways; all of these are one place.
MYSURU_SPELLINGS = {"mysuru", "mysore", "mysur", "mysoru", "msyuru", "mysuru;"}

# Words that turn up in the city position but never name a place: unit markers,
# conjunctions, and the tail of an email or website typed into the address.
NON_CITY_WORDS = {
    "dist", "district", "dt", "taluk", "taluq", "tq", "tk", "hobli", "post",
    "village", "town", "city", "road", "street", "cross", "main", "stage",
    "nagar", "nagara", "layout", "and", "com", "in", "gmail", "yahoo", "www",
    "near", "opp", "behind", "no", "new", "old",
    "dis", "dst", "districtg", "taloku", "karnataka", "state", "pin",
}

# Towns that actually appear in the membership. Used to fold the ledger's many
# misspellings ('ysore', 'Myore', 'Najanagud') onto one canonical spelling, so
# the admin city filter isn't 52 near-duplicate entries.
CANONICAL_CITIES = [
    "Mysuru", "Mandya", "Nanjangud", "Chamarajanagara", "Bannur", "Hunsur",
    "T. Narasipura", "Periyapatna", "K.R. Nagara", "H.D. Kote", "Bengaluru",
    "Pandavapura", "Malavalli", "Kollegal", "Hullahalli", "Srirangapatna",
    "Maddur", "Gundlupet", "Saligrama", "Sargur",
]
_CITY_LOOKUP = {c.lower().replace(".", "").replace(" ", ""): c for c in CANONICAL_CITIES}


def canonical_city(name):
    """Fold a written city onto its canonical spelling, if it's close enough."""
    if not name:
        return None, None
    key = re.sub(r"[^a-z]", "", name.lower())
    if key in MYSURU_SPELLINGS or key in ("mysuruv", "ysore", "mysoe", "myore"):
        return "Mysuru", None
    if key in _CITY_LOOKUP:
        return _CITY_LOOKUP[key], None
    import difflib

    hit = difflib.get_close_matches(key, list(_CITY_LOOKUP), n=1, cutoff=0.82)
    if hit:
        fixed = _CITY_LOOKUP[hit[0]]
        return fixed, (None if fixed.lower() == name.lower()
                       else f"city {name!r} read as {fixed!r}")
    return name.strip().title(), None

# The trailing city, plus any administrative suffix the ledger appends to it:
# 'Mysore Dist.', 'Mysuru(D)', 'Mysuru Tk & Dt', 'Mysore Taluk'.
CITY_TAIL_RE = re.compile(
    r"[\s,;\-]*(?P<city>[A-Za-z]{3,})\s*"
    r"(?:\(\s*[A-Za-z]\s*\))?"
    r"(?:[\s,&\-]*(?:Dist(?:rict)?|Dt|Tq|Tk|Taluk|Taluq|Talluk)\b\.?)*"
    r"\s*[.,;)]*\s*$",
    re.I,
)


def parse_city_pincode(line):
    """Split the final address line into (remainder, city, pincode, warning).

    The city name is the last word of the line, not everything before the
    number - the ledger runs the whole street address and the city together on
    one line, so anything else silently discards real address text.

    Mysuru postcodes are abbreviated to their last digits ('Mysuru 24',
    'Mysore-4' = 570024, 570004). That expansion is only safe because those
    rows are all in the 5700xx range, so it is refused for other cities.
    """
    line = line.strip()
    m = CITY_RE.match(line)
    num = None
    if m:
        head, num = m.group(1), m.group(2)
    else:
        head = line
    head = head.strip().strip(",;-")

    # Rural rows end 'Mysore Dist.', 'Mysore(D)', 'Mysuru Tk & Dt' - the city is
    # the word before those administrative markers, not the marker itself.
    city, remainder = None, head
    probe = head
    for _ in range(4):
        m2 = CITY_TAIL_RE.search(probe)
        if not m2:
            break
        candidate = m2.group("city")
        if candidate.lower() in NON_CITY_WORDS:
            # A marker or a fragment of an address/email, not a place. Step
            # back past it and look at the word before.
            probe = probe[: m2.start()]
            continue
        city = candidate
        # Slice the original string so the address keeps its own punctuation.
        remainder = probe[: m2.start()]
        break
    remainder = remainder.strip().strip(",;-–—.")

    warn = None
    if city and len(city) <= 2:
        # A stray fragment, not a place name - keep it in the address.
        remainder, city = head, None
    else:
        city, warn = canonical_city(city)

    pin = None
    short = None
    if num:
        if len(num) == 6:
            pin = num
        elif city == "Mysuru" or city is None:
            # Defer: a row with no readable city defaults to Mysuru later, and
            # the abbreviation is expandable once that default is applied.
            short = num
        else:
            remainder = (remainder + " " + num).strip()
            warn = f"short pincode {num!r} on non-Mysuru city {city!r} left in address"
    return remainder or None, city, pin, warn, short


def expand_short_pincode(num):
    """'24' / '4' -> 570024 / 570004, valid only inside Mysuru's 5700xx range."""
    return "5700" + num.zfill(2) if len(num) <= 2 else "57" + num.zfill(4)


def parse_name_address(lines):
    """Split the free-text 'Name & address' cell.

    Line 1 is always the member. A studio line and an 'S/o' parentage line may
    follow in either order; whatever remains is the postal address, whose last
    line carries city and pincode.
    """
    warnings = []
    name, alias, extra_parentage = clean_name(lines[0])
    business = None
    business_raw = None
    parentage = None
    rest = []
    for ln in lines[1:]:
        if re.match(r"^(s|d|w)\s*[/.]?\s*o\b", ln.strip(), re.I) and not parentage:
            parentage = ln.strip()
        elif business is None and is_business(ln):
            business, business_raw = clean_business(ln)
            if business_raw:
                warnings.append("business line held address text; kept in notes")
        else:
            rest.append(ln.strip())
    city = state = pincode = None
    short_pin = None
    if rest:
        remainder, city, pincode, w, short_pin = parse_city_pincode(rest[-1])
        if w:
            warnings.append(w)
        # The city sits at the end of a line that also carries street detail;
        # keep that detail as address, drop only the line if nothing is left.
        rest = rest[:-1] + ([remainder] if remainder else [])
    addr1 = rest[0] if rest else None
    addr2 = ", ".join(rest[1:]) if len(rest) > 1 else None
    if not addr1:
        addr1 = city or "(address not recorded in ledger)"
        warnings.append("no address lines in ledger")
    if not city:
        city = "Mysuru"
        warnings.append("city missing; defaulted to Mysuru")
    if short_pin and not pincode:
        pincode = expand_short_pincode(short_pin)
    state = "Karnataka"
    if extra_parentage and not parentage:
        parentage = extra_parentage
    return {
        "name": name,
        "alias": alias,
        "business": business,
        "business_raw": business_raw,
        "parentage": parentage,
        "address_line1": addr1,
        "address_line2": addr2,
        "city": city,
        "state": state,
        "pincode": pincode,
    }, warnings


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    out_dir = sys.argv[1]
    photo_dir = os.path.join(out_dir, "photos")
    os.makedirs(photo_dir, exist_ok=True)

    seen = {}
    cleared = set()
    rows_out = []
    report = []
    stats = {
        "rows": 0, "blank": 0, "written": 0, "photos": 0, "no_photo": 0,
        "dup": 0, "no_phone": 0, "no_dob": 0,
    }

    for path in sys.argv[2:]:
        for ledger_no, texts, imgs, z in read_rows(path):
            stats["rows"] += 1
            name_lines = texts[2]
            if not name_lines and not texts[3] and not imgs:
                # Not an empty slot: the association clears a row when the
                # member leaves or dies, so the number is retired. It must not
                # be silently reassigned - reissuing it would let the wrong
                # person pass onboarding verification.
                stats["blank"] += 1
                cleared.add(ledger_no)
                report.append(f"{ledger_no:>5}  SKIPPED: cleared row (member left or died)")
                continue

            warns = []
            parsed, w = parse_name_address(name_lines)
            warns += w
            phone, extra_phones = parse_phones(texts[3])
            dob, w = parse_dob(texts[4])
            if w:
                warns.append(w)
            bg, w = parse_blood_group(texts[5])
            if w:
                warns.append(w)

            legacy_id = str(ledger_no)
            notes = []
            if ledger_no in seen:
                stats["dup"] += 1
                notes.append(
                    f"LEDGER CONFLICT: ledger no. {ledger_no} is also used by "
                    f"'{seen[ledger_no]}'. Number left unset here pending "
                    f"confirmation from the association."
                )
                warns.append(f"duplicate ledger no; legacy_id left blank")
                legacy_id = ""
            else:
                seen[ledger_no] = parsed["name"]

            if parsed["business_raw"]:
                notes.append("Business line (ledger): " + parsed["business_raw"])
            if parsed["alias"]:
                notes.append("Also known as: " + parsed["alias"])
            if parsed["parentage"]:
                notes.append(parsed["parentage"])
            if texts[5] and not bg:
                # Don't lose what was written there - one row says "Death",
                # which the association will want to see rather than a blank.
                notes.append("Blood group column (ledger): " + " ".join(texts[5]))
            if extra_phones:
                notes.append("Other numbers: " + ", ".join(extra_phones))
            if texts[1]:
                notes.append("Date of joining (ledger): " + " ".join(texts[1]))

            photo_name = ""
            if imgs:
                ext = os.path.splitext(imgs[0])[1] or ".jpeg"
                # A duplicated ledger number must not overwrite the first
                # member's photo - suffix it so both survive for manual triage.
                suffix = "" if legacy_id else f"-dup{stats['dup']}"
                photo_name = f"{ledger_no}{suffix}{ext}"
                with open(os.path.join(photo_dir, photo_name), "wb") as fh:
                    fh.write(z.read("word/" + imgs[0]))
                stats["photos"] += 1
                if len(imgs) > 1:
                    warns.append(f"{len(imgs)} photos in row; kept the first")
            else:
                stats["no_photo"] += 1

            if not phone:
                stats["no_phone"] += 1
                warns.append("no usable mobile number")
            if not dob:
                stats["no_dob"] += 1

            rows_out.append({
                "first_name": parsed["name"],
                "last_name": "",
                "email": "",
                "phone": phone or "",
                "legacy_id": legacy_id,
                "profession": profession_for(parsed["business"]) or "",
                "business_name": parsed["business"] or "",
                "address_line1": parsed["address_line1"],
                "address_line2": parsed["address_line2"] or "",
                "area": "",
                "city": parsed["city"],
                "state": parsed["state"],
                "pincode": parsed["pincode"] or "",
                "dob": dob or "",
                "blood_group": bg or "",
                "status": "active",
                "fees_paid_upto": "",
                "death_fund_covered": "false",
                "notes": " | ".join(notes),
            })
            stats["written"] += 1
            for warn in warns:
                report.append(f"{ledger_no:>5}  {warn}")

    csv_path = os.path.join(out_dir, "members.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as fh:
        wr = csv.DictWriter(fh, fieldnames=CSV_HEADERS)
        wr.writeheader()
        wr.writerows(rows_out)

    # Manifest so the photo upload step can pair files to members without
    # re-parsing the .docx.
    with open(os.path.join(out_dir, "photos.csv"), "w", newline="", encoding="utf-8") as fh:
        wr = csv.writer(fh)
        wr.writerow(["legacy_id", "file"])
        for f in sorted(os.listdir(photo_dir)):
            stem = f.split(".")[0]
            # '1322-dup1' has no owning member yet; left blank for triage.
            wr.writerow(["" if "-dup" in stem else stem, f])

    with open(os.path.join(out_dir, "report.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(report) + "\n")

    # Numbers that exist in the ledger's range but belong to nobody. The
    # association should confirm these before any of them is reissued.
    highest = max(seen) if seen else 0
    absent = sorted(set(range(1, highest + 1)) - set(seen) - cleared)
    with open(os.path.join(out_dir, "retired-numbers.txt"), "w", encoding="utf-8") as fh:
        fh.write(
            "Ledger numbers with no member record after import.\n"
            "Do NOT reassign any of these without confirming with the\n"
            "association first: reissuing a number that still belongs to a\n"
            "former member would let the wrong person pass onboarding.\n\n"
        )
        fh.write(f"Cleared rows - member left or died ({len(cleared)}):\n")
        fh.write("  " + ", ".join(str(n) for n in sorted(cleared)) + "\n\n")
        fh.write(f"Never present in either document ({len(absent)}):\n")
        fh.write("  " + ", ".join(str(n) for n in absent) + "\n")
    stats["retired"] = len(cleared) + len(absent)

    for k, v in stats.items():
        print(f"{k:>10}: {v}")
    print(f"\nwrote {csv_path}")
    print(f"warnings: {len(report)} (see {out_dir}/report.txt)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
