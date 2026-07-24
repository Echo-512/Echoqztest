from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np
import pdfplumber
import pypdfium2 as pdfium
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = Path(
    "/Users/zhaoxuan/Library/Containers/com.tencent.xinWeChat/Data/Documents/"
    "xwechat_files/wxid_649gsmd2mds132_d562/temp/drag/"
    "05、B森『图形推理』-2【部分解析136页】.pdf"
)
OUTPUT = ROOT / "public/questions/beisen-2"
REVIEW = ROOT / "tmp/bank2-review"
SCALE = 3.0

PROMPT = re.compile(
    r"^(?:接下来|根据|空缺|问号|从所给|从下列|下列|找出|哪一|哪个|以下|"
    r"请选择|图形中|题中|上图|右边|下一|图中|哪组|哪一个|补全|"
    r"观察|请选出|选出|将下列|把下列|空着|选择最)"
)
ANSWER = re.compile(r"^(?:正确答案|答案)\s*[：:]?\s*[A-E]")
DIGITS = {
    "!": "1",
    "$": "2",
    "%": "3",
    "&": "4",
    "'": "5",
    "(": "6",
    ")": "7",
    "*": "8",
    "+": "9",
    ",": "0",
}

MANUAL_STARTS = {
    75: (43, 350.0),
    81: (47, 70.0),
    115: (65, 545.0),
    123: (71, 135.0),
    128: (74, 320.0),
    131: (76, 350.0),
    138: (79, 700.0),
    142: (82, 70.0),
}

# These marker ranges are malformed in the source PDF. The coordinates were
# checked against the rendered page; they still use untouched PDF pixels.
LATE_RAW_OVERRIDES = {
    214: (123, 950, 1800),
    220: (126, 900, 1970),
}

LATE_RAW_SLICE_OVERRIDES = {
    # Marker 62 is misplaced in the PDF text layer, so marker 61's band also
    # contains the next question. Keep only the first untouched question band.
    213: (0, 1480),
}

# A few source rows use unusually short option-card borders. These ranges were
# measured on the 3x untouched PDF render. They only define crop boundaries;
# no pixels are painted, erased, or enhanced.
LATE_ROW_OVERRIDES = {
    178: [(746, 885), (919, 1060), (1093, 1233), (1268, 1407)],
    184: [(631, 799), (837, 1004), (1043, 1209), (1249, 1415), (1455, 1655)],
    189: [(272, 429), (468, 625), (664, 820), (859, 1015)],
    159: [(1709, 1881), (1916, 2088), (2123, 2295), (2330, 2544)],
    207: [(267, 389), (421, 544), (577, 700), (733, 856)],
    215: [(669, 873), (909, 1112), (1147, 1350), (1386, 1608)],
    223: [(187, 340), (382, 540), (583, 740), (783, 936)],
}

OPTION_FINAL_INSETS = {
    # The red answer box on option C sits five pixels outside the arrow.
    (207, 2): (0, 0, 5, 6),
}


@dataclass(frozen=True)
class Position:
    page: int
    top: float


def lines_for(page):
    words = page.extract_words(x_tolerance=2, y_tolerance=2, keep_blank_chars=False)
    groups = []
    for word in sorted(words, key=lambda item: (round(item["top"], 1), item["x0"])):
        for group in groups:
            if abs(group["top"] - word["top"]) <= 2.0:
                group["words"].append(word)
                group["top"] = min(group["top"], word["top"])
                group["bottom"] = max(group["bottom"], word["bottom"])
                break
        else:
            groups.append({"top": word["top"], "bottom": word["bottom"], "words": [word]})
    result = []
    for group in sorted(groups, key=lambda item: item["top"]):
        words = sorted(group["words"], key=lambda item: item["x0"])
        result.append(
            {
                "text": " ".join(word["text"] for word in words),
                "top": group["top"],
                "bottom": group["bottom"],
                "x0": min(word["x0"] for word in words),
            }
        )
    return result


def decode_marker(text):
    decoded = "".join(DIGITS[char] for char in text if char in DIGITS)
    return int(decoded) if decoded else None


def connected_components(mask):
    height, width = mask.shape
    seen = np.zeros(mask.shape, dtype=bool)
    components = []
    for y in range(height):
        for x in np.flatnonzero(mask[y] & ~seen[y]):
            if seen[y, x]:
                continue
            stack = [(y, x)]
            seen[y, x] = True
            points = []
            while stack:
                cy, cx = stack.pop()
                points.append((cy, cx))
                for ny in range(max(0, cy - 1), min(height, cy + 2)):
                    for nx in range(max(0, cx - 1), min(width, cx + 2)):
                        if mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            stack.append((ny, nx))
            components.append(points)
    return components


def trim_content(image, threshold=232, padding=22):
    array = np.asarray(image.convert("RGB"))
    dark = np.min(array, axis=2) < threshold
    rows = np.flatnonzero(dark.sum(axis=1) >= 2)
    cols = np.flatnonzero(dark.sum(axis=0) >= 2)
    if len(rows) == 0 or len(cols) == 0 or dark.sum() < 60:
        return None
    left = max(0, int(cols[0]) - padding)
    right = min(image.width, int(cols[-1]) + padding + 1)
    top = max(0, int(rows[0]) - padding)
    bottom = min(image.height, int(rows[-1]) + padding + 1)
    return image.crop((left, top, right, bottom))


def trim_option(image):
    """Find a dark neutral option figure but return untouched source pixels."""
    array = np.asarray(image.convert("RGB"))
    minimum = np.min(array, axis=2)
    maximum = np.max(array, axis=2)
    neutral_dark = (minimum < 225) & ((maximum - minimum) < 44)

    # Card borders sit at the top and bottom. They are not part of the option.
    inset = max(4, int(image.height * 0.035))
    neutral_dark[:inset] = False
    neutral_dark[max(inset, image.height - inset) :] = False

    components = []
    for points in connected_components(neutral_dark):
        if len(points) < 4:
            continue
        ys = [point[0] for point in points]
        xs = [point[1] for point in points]
        left, right = min(xs), max(xs)
        top, bottom = min(ys), max(ys)
        width = right - left + 1
        height = bottom - top + 1
        if (width > image.width * 0.7 and height <= 5) or (
            width > 70 and height <= 6
        ):
            continue
        components.append(
            {
                "left": left,
                "right": right,
                "top": top,
                "bottom": bottom,
                "ink": len(points),
            }
        )
    if not components:
        return None

    # Merge nearby strokes into figure groups. A mouse pointer or a partial
    # radio ring remains a much smaller isolated group and is excluded without
    # modifying the source pixels.
    groups = []
    for component in sorted(components, key=lambda item: item["left"]):
        for group in groups:
            horizontal_gap = max(
                0,
                component["left"] - group["right"],
                group["left"] - component["right"],
            )
            vertical_gap = max(
                0,
                component["top"] - group["bottom"],
                group["top"] - component["bottom"],
            )
            if horizontal_gap <= 32 and vertical_gap <= 34:
                group["left"] = min(group["left"], component["left"])
                group["right"] = max(group["right"], component["right"])
                group["top"] = min(group["top"], component["top"])
                group["bottom"] = max(group["bottom"], component["bottom"])
                group["ink"] += component["ink"]
                break
        else:
            groups.append(dict(component))

    meaningful = [group for group in groups if group["ink"] >= 22]
    if not meaningful:
        return None
    figure = max(
        meaningful,
        key=lambda group: (
            group["ink"],
            (group["right"] - group["left"]) * (group["bottom"] - group["top"]),
        ),
    )
    left = max(0, int(figure["left"]))
    right = min(image.width, int(figure["right"]) + 3)
    top = max(0, int(figure["top"]))
    bottom = min(image.height, int(figure["bottom"]) + 2)
    result = image.crop((left, top, right, bottom))

    # Answer annotations are saturated red/blue and sit outside the actual
    # neutral-gray figure. If an annotation edge still touches this tight crop,
    # move the crop boundary past that edge. This is structural cropping only:
    # the retained figure pixels remain exactly as rendered from the PDF.
    for _ in range(3):
        rgb = np.asarray(result.convert("RGB")).astype(np.int16)
        blue = (
            (rgb[:, :, 2] > 125)
            & (rgb[:, :, 2] - rgb[:, :, 0] > 38)
            & (rgb[:, :, 2] - rgb[:, :, 1] > 10)
        )
        red = (
            (rgb[:, :, 0] > 125)
            & (rgb[:, :, 0] - rgb[:, :, 1] > 45)
            & (rgb[:, :, 0] - rgb[:, :, 2] > 38)
        )
        colored = blue | red
        ys, xs = np.where(colored)
        if len(xs) < 16:
            break
        color_box = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
        candidates = [
            (color_box[0], "left", color_box[2] + 2),
            (result.width - 1 - color_box[2], "right", color_box[0] - 1),
            (color_box[1], "top", color_box[3] + 2),
            (result.height - 1 - color_box[3], "bottom", color_box[1] - 1),
        ]
        changed = False
        for _, side, boundary in sorted(candidates):
            if side == "left" and 0 < boundary < result.width * 0.45:
                candidate = result.crop((boundary, 0, result.width, result.height))
            elif side == "right" and result.width * 0.55 < boundary < result.width:
                candidate = result.crop((0, 0, boundary, result.height))
            elif side == "top" and 0 < boundary < result.height * 0.42:
                candidate = result.crop((0, boundary, result.width, result.height))
            elif side == "bottom" and result.height * 0.58 < boundary < result.height:
                candidate = result.crop((0, 0, result.width, boundary))
            else:
                continue
            candidate_array = np.asarray(candidate.convert("RGB"))
            candidate_neutral = (
                (np.min(candidate_array, axis=2) < 225)
                & ((np.max(candidate_array, axis=2) - np.min(candidate_array, axis=2)) < 44)
            )
            if candidate.width >= 18 and candidate.height >= 18 and candidate_neutral.sum() >= 22:
                result = candidate
                changed = True
                break
        if not changed:
            break
    return result


def remove_isolated_number_prefix(image):
    """Drop a page-top question number when a cross-page stem starts far below."""
    array = np.asarray(image.convert("RGB"))
    dark_rows = np.flatnonzero((np.min(array, axis=2) < 220).sum(axis=1) >= 3)
    if len(dark_rows) < 2:
        return image
    scale = image.width / 1488.0
    gaps = np.diff(dark_rows)
    candidates = np.flatnonzero(gaps > 150 * scale)
    if len(candidates) == 0:
        return image
    index = int(candidates[np.argmax(gaps[candidates])])
    if dark_rows[index] > 110 * scale:
        return image
    crop_top = max(0, int(dark_rows[index + 1] - 30 * scale))
    return image.crop((0, crop_top, image.width, image.height))


def find_option_rows_by_borders(image):
    """Find vertical option-card ranges from untouched long PDF row borders."""
    array = np.asarray(image.convert("RGB"))
    width = image.width
    x0 = int(width * 0.16)
    x1 = int(width * 0.92)
    nonwhite = np.min(array[:, x0:x1], axis=2) < 250
    counts = nonwhite.sum(axis=1)
    rows = np.flatnonzero(counts > (x1 - x0) * 0.31)
    runs = []
    for row in rows:
        if not runs or row > runs[-1][-1] + 1:
            runs.append([row])
        else:
            runs[-1].append(row)
    lines = [float((run[0] + run[-1]) / 2) for run in runs]
    scale = width / 1488.0

    best = []
    for start_index in range(len(lines) - 1):
        chain = []
        cursor = start_index
        while cursor + 1 < len(lines):
            top = lines[cursor]
            bottom = lines[cursor + 1]
            height = bottom - top
            if not (65 * scale <= height <= 210 * scale):
                break
            chain.append((int(top), int(bottom)))
            if len(chain) == 6:
                break
            if cursor + 2 >= len(lines):
                break
            gap = lines[cursor + 2] - bottom
            if not (12 * scale <= gap <= 85 * scale):
                break
            cursor += 2
        if len(chain) > len(best):
            best = chain

    if len(best) >= 3:
        # The last option may be clipped at the marker boundary; its top border
        # is present even when its bottom border is not.
        last_bottom = best[-1][1]
        following = [line for line in lines if line > last_bottom]
        if following:
            possible_top = following[0]
            typical_height = float(np.median([bottom - top for top, bottom in best]))
            if 12 * scale <= possible_top - last_bottom <= 85 * scale:
                inferred_bottom = min(image.height, int(possible_top + typical_height))
                if inferred_bottom - possible_top >= 55 * scale:
                    best.append((int(possible_top), inferred_bottom))
    return best if 3 <= len(best) <= 6 else []


pdf_document = pdfium.PdfDocument(str(PDF_PATH))


@lru_cache(maxsize=5)
def render_page(page_number):
    bitmap = pdf_document[page_number - 1].render(scale=SCALE)
    return bitmap.to_pil().convert("RGB")


def raw_bands(start, end):
    bands = []
    for page_number in range(start.page, end.page + 1):
        page_image = render_page(page_number)
        scale_y = page_image.height / 842.0
        crop_top = int((start.top if page_number == start.page else 0) * scale_y)
        crop_bottom = int((end.top if page_number == end.page else 842.0) * scale_y)
        crop_top = max(0, min(page_image.height, crop_top))
        crop_bottom = max(crop_top, min(page_image.height, crop_bottom))
        if crop_bottom - crop_top >= 4:
            bands.append(page_image.crop((0, crop_top, page_image.width, crop_bottom)))
    return bands


def concatenate(images, gap=18, keep_width=False):
    if keep_width:
        pieces = images
    else:
        pieces = [trim_content(image) for image in images]
        pieces = [piece for piece in pieces if piece is not None]
    if not pieces:
        return None
    width = max(piece.width for piece in pieces)
    height = sum(piece.height for piece in pieces) + gap * (len(pieces) - 1)
    canvas = Image.new("RGB", (width, height), "white")
    cursor = 0
    for piece in pieces:
        canvas.paste(piece, (0, cursor))
        cursor += piece.height + gap
    return canvas


def find_radio_centers(image):
    width = image.width
    x0 = int(width * 0.14)
    x1 = int(width * 0.235)
    column = np.asarray(image.convert("RGB"))[:, x0:x1]
    mask = np.min(column, axis=2) < 248
    candidates = []
    scale = width / 1488.0
    for component in connected_components(mask):
        ys = [point[0] for point in component]
        xs = [point[1] for point in component]
        component_width = max(xs) - min(xs) + 1
        component_height = max(ys) - min(ys) + 1
        center_x = (min(xs) + max(xs)) / 2 + x0
        center_y = (min(ys) + max(ys)) / 2
        if (
            7 * scale <= component_width <= 54 * scale
            and 7 * scale <= component_height <= 54 * scale
            and width * 0.16 <= center_x <= width * 0.225
            and 0.48 <= component_width / component_height <= 1.8
        ):
            candidates.append((center_x, center_y))

    # Selected radios are blue and may connect to the highlighted card border
    # in grayscale. Detect their saturated ring independently.
    rgb = np.asarray(image.convert("RGB")).astype(np.int16)
    blue = (
        (rgb[:, :, 2] > 125)
        & (rgb[:, :, 2] - rgb[:, :, 0] > 38)
        & (rgb[:, :, 2] - rgb[:, :, 1] > 10)
    )[:, x0:x1]
    for component in connected_components(blue):
        if len(component) < 18:
            continue
        ys = [point[0] for point in component]
        xs = [point[1] for point in component]
        component_width = max(xs) - min(xs) + 1
        component_height = max(ys) - min(ys) + 1
        center_x = (min(xs) + max(xs)) / 2 + x0
        center_y = (min(ys) + max(ys)) / 2
        if (
            9 * scale <= component_width <= 58 * scale
            and 9 * scale <= component_height <= 58 * scale
            and width * 0.16 <= center_x <= width * 0.225
        ):
            candidates.append((center_x, center_y))

    # Actual radios share one x column. Cluster by x first so similarly sized
    # shapes in the question stem cannot become a false extra option.
    x_clusters = []
    for center_x, center_y in sorted(candidates):
        for cluster in x_clusters:
            if abs(center_x - cluster["x"]) <= 10 * scale:
                cluster["items"].append((center_x, center_y))
                cluster["x"] = float(np.median([item[0] for item in cluster["items"]]))
                break
        else:
            x_clusters.append({"x": center_x, "items": [(center_x, center_y)]})

    choices = []
    for cluster in x_clusters:
        centers = []
        for _, center in sorted(cluster["items"], key=lambda item: item[1]):
            if not centers or center - centers[-1] > 13 * scale:
                centers.append(center)
        for length in range(3, min(6, len(centers)) + 1):
            for start_index in range(0, len(centers) - length + 1):
                sequence = centers[start_index : start_index + length]
                gaps = np.diff(sequence)
                median_gap = float(np.median(gaps))
                if not (72 * scale <= median_gap <= 285 * scale):
                    continue
                variation = float(np.std(gaps) / median_gap)
                if variation > 0.075:
                    continue
                end_gap = max(0.0, image.height - sequence[-1])
                score = -length * 10 + variation * 100 + end_gap / image.height
                choices.append((score, sequence))
    return min(choices, key=lambda item: item[0])[1] if choices else []


def split_back_question(image, question_number=None):
    manual_rows = LATE_ROW_OVERRIDES.get(question_number)
    border_rows = find_option_rows_by_borders(image)
    centers = find_radio_centers(image)
    matched_border_rows = []
    if border_rows and centers:
        matched_border_rows = [
            row
            for row in border_rows
            if any(row[0] <= center <= row[1] for center in centers)
        ]

    if manual_rows:
        rows = manual_rows
        stem_bottom = rows[0][0]
    elif len(matched_border_rows) >= 3:
        rows = matched_border_rows
        stem_bottom = rows[0][0]
    elif len(centers) >= 3:
        spacing = float(np.median(np.diff(centers)))
        stem_bottom = max(1, int(centers[0] - spacing * 0.43))
        rows = []
        for index, center in enumerate(centers):
            top = int((centers[index - 1] + center) / 2) if index else stem_bottom
            bottom = (
                int((center + centers[index + 1]) / 2)
                if index + 1 < len(centers)
                else min(image.height, int(center + spacing * 0.49))
            )
            rows.append((top, bottom))
    elif border_rows:
        rows = border_rows
        stem_bottom = rows[0][0]
    else:
        return None

    raw_stem = remove_isolated_number_prefix(image.crop((0, 0, image.width, stem_bottom)))
    stem = trim_content(raw_stem)
    if stem is None:
        return None

    option_images = []
    option_x = int(image.width * 0.205)
    option_right = int(image.width * 0.91)
    for top, bottom in rows:
        option = trim_option(image.crop((option_x, top, option_right, bottom)))
        if option is None:
            return None
        option_images.append(option)
    return stem, option_images


def save_webp(image, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "WEBP", quality=97, method=6)


def parse_positions():
    all_lines = []
    early_answers = []
    late_markers = {}
    with pdfplumber.open(PDF_PATH) as pdf:
        for page_number in range(1, 89):
            for line in lines_for(pdf.pages[page_number - 1]):
                item = {"page": page_number, **line}
                all_lines.append(item)
                if ANSWER.search(line["text"]):
                    early_answers.append(item)

        for page_number in range(89, 136):
            words = pdf.pages[page_number - 1].extract_words(
                x_tolerance=2, y_tolerance=2, keep_blank_chars=False
            )
            for word in words:
                if 80 <= word["x0"] <= 120:
                    number = decode_marker(word["text"])
                    if number and 1 <= number <= 85:
                        late_markers[number] = Position(
                            page_number, max(0.0, word["top"] - 3.0)
                        )

    if len(early_answers) != 152:
        raise RuntimeError(f"Expected 152 early answers, found {len(early_answers)}")
    if sorted(late_markers) != list(range(1, 86)):
        missing = sorted(set(range(1, 86)) - set(late_markers))
        raise RuntimeError(f"Late marker mismatch; missing {missing}")

    early_starts = {}
    for question_number, answer in enumerate(early_answers, start=1):
        if question_number in MANUAL_STARTS:
            page_number, top = MANUAL_STARTS[question_number]
            early_starts[question_number] = Position(page_number, top)
            continue
        previous_answer = early_answers[question_number - 2] if question_number > 1 else None
        previous_index = all_lines.index(previous_answer) if previous_answer else -1
        answer_index = all_lines.index(answer)
        between = all_lines[previous_index + 1 : answer_index]
        candidates = [line for line in between if PROMPT.search(line["text"])]
        if not candidates:
            raise RuntimeError(f"No prompt candidate for early question {question_number}")
        prompt = candidates[-1]
        start_top = max(0.0, prompt["top"] - 4.0)
        same_page_before = [
            line
            for line in between
            if line["page"] == prompt["page"]
            and line["top"] < prompt["top"]
            and prompt["top"] - line["bottom"] <= 8.0
            and re.fullmatch(r"\d{1,3}", line["text"].strip())
        ]
        if same_page_before:
            start_top = max(0.0, same_page_before[-1]["top"] - 3.0)
        early_starts[question_number] = Position(prompt["page"], start_top)
    return early_answers, early_starts, late_markers


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    for old_asset in OUTPUT.glob("q*.webp"):
        old_asset.unlink()
    for old_review in REVIEW.glob("q*-raw.png"):
        old_review.unlink()
    early_answers, early_starts, late_markers = parse_positions()
    manifest = []
    failures = []

    for question_number in range(1, 153):
        answer = early_answers[question_number - 1]
        start = early_starts[question_number]
        end = Position(answer["page"], max(0.0, answer["top"] - 4.0))
        image = concatenate(raw_bands(start, end))
        if image is None:
            failures.append({"question": question_number, "reason": "empty early crop"})
            continue
        filename = f"q{question_number:03d}.webp"
        save_webp(image, OUTPUT / filename)
        manifest.append(
            {
                "question": question_number,
                "pages": list(range(start.page, end.page + 1)),
                "image": f"/questions/beisen-2/{filename}",
                "optionImages": [],
            }
        )

    for clean_number in range(1, 86):
        question_number = 152 + clean_number
        start = late_markers[clean_number]
        end = (
            late_markers[clean_number + 1]
            if clean_number < 85
            else Position(136, 80.0)
        )
        if question_number in LATE_RAW_OVERRIDES:
            page_number, top_at_1488, bottom_at_1488 = LATE_RAW_OVERRIDES[question_number]
            page_image = render_page(page_number)
            coordinate_scale = page_image.width / 1488.0
            raw = page_image.crop(
                (
                    0,
                    int(top_at_1488 * coordinate_scale),
                    page_image.width,
                    min(page_image.height, int(bottom_at_1488 * coordinate_scale)),
                )
            )
        else:
            raw = concatenate(raw_bands(start, end), keep_width=True)
        if raw is not None and question_number in LATE_RAW_SLICE_OVERRIDES:
            top, bottom = LATE_RAW_SLICE_OVERRIDES[question_number]
            raw = raw.crop((0, top, raw.width, min(raw.height, bottom)))
        split = split_back_question(raw, question_number) if raw is not None else None
        if split is None:
            if raw is not None:
                raw.save(REVIEW / f"q{question_number:03d}-raw.png")
            failures.append(
                {
                    "question": question_number,
                    "pages": list(range(start.page, end.page + 1)),
                    "reason": "could not split late question",
                }
            )
            continue
        stem, options = split
        stem_name = f"q{question_number:03d}-stem.webp"
        save_webp(stem, OUTPUT / stem_name)
        option_paths = []
        for index, option in enumerate(options):
            if (question_number, index) in OPTION_FINAL_INSETS:
                left, top, right, bottom = OPTION_FINAL_INSETS[(question_number, index)]
                option = option.crop(
                    (
                        left,
                        top,
                        max(left + 1, option.width - right),
                        max(top + 1, option.height - bottom),
                    )
                )
            letter = chr(ord("A") + index)
            option_name = f"q{question_number:03d}-{letter}.webp"
            save_webp(option, OUTPUT / option_name)
            option_paths.append(f"/questions/beisen-2/{option_name}")
        manifest.append(
            {
                "question": question_number,
                "pages": list(range(start.page, end.page + 1)),
                "image": f"/questions/beisen-2/{stem_name}",
                "optionImages": option_paths,
            }
        )

    (OUTPUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (REVIEW / "failures.json").write_text(
        json.dumps(failures, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "prepared": len(manifest),
                "early": sum(item["question"] <= 152 for item in manifest),
                "late": sum(item["question"] > 152 for item in manifest),
                "failures": failures,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
