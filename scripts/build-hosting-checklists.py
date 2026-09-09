"""Generate printable PDFs from JSON exported from lib/checklists.ts."""
import json
import sys
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase.pdfmetrics import stringWidth, registerFont
from reportlab.pdfbase.ttfonts import TTFont

font_dir = Path(sys.argv[2])
for alias, filename in [("Display", "PlayfairDisplay-Semibold.ttf"), ("Body", "Lato-Regular.ttf")]:
    registerFont(TTFont(alias, str(font_dir / filename)))

root = Path(__file__).resolve().parents[1]
destination = root / "public/checklists"
destination.mkdir(parents=True, exist_ok=True)
kits = json.loads(Path(sys.argv[1]).read_text())
forest, gold, muted = map(HexColor, ["#244438", "#AC8D4D", "#53665D"])

def wrapped(c, text, x, y, width=524, size=10, leading=15, font="Body"):
    c.setFont(font, size)
    words = text.split()
    line = ""
    for word in words:
        candidate = (line + " " + word).strip()
        if stringWidth(candidate, font, size) > width and line:
            c.drawString(x, y, line)
            y -= leading
            line = word
        else:
            line = candidate
    if line:
        c.drawString(x, y, line)
        y -= leading
    return y

def masthead(c):
    c.drawImage(str(root / "public/images/pp-mark.png"), 44, 736, 40, 40, mask="auto")
    c.setFillColor(forest); c.setFont("Display", 21)
    c.drawString(94, 751, "Place & Plenty")
    c.setFont("Body", 8)
    c.drawRightString(568, 750, "HOME HOSTING. MADE SIMPLE.")
    c.setStrokeColor(gold); c.setLineWidth(1); c.line(44, 725, 568, 725)

def footer(c, number):
    c.setStrokeColor(gold); c.line(44, 108, 568, 108)
    c.setFillColor(forest); c.setFont("Display", 15)
    c.drawString(44, 87, "Give your whole plan a place to live.")
    c.setFont("Body", 10)
    c.drawString(44, 69, "Start free on the website: placeandplenty.com/signup")
    c.linkURL("https://placeandplenty.com/signup", (44, 64, 410, 82), relative=0)
    c.setFont("Body", 10)
    c.drawString(44, 48, "I built it for you because I needed it too. — Alexis")
    c.setFont("Body", 8); c.drawRightString(568, 28, f"Place & Plenty | {number} / 2")

for kit in kits:
    path = destination / f"put-together-get-together-{kit['slug']}.pdf"
    c = canvas.Canvas(str(path), pagesize=(612, 792))
    c.setTitle(f"The Put-Together Get-Together Starter Kit - {kit['name']} Edition")
    c.setAuthor("Alexis Hughes-Williams | Place & Plenty")
    masthead(c)
    c.setFont("Body", 9); c.drawString(44, 705, "THE PUT-TOGETHER GET-TOGETHER STARTER KIT")
    c.setFont("Display", 29); c.drawString(44, 673, kit['name'] + " Edition")
    c.setFont("Body", 12); c.drawString(44, 652, kit['note'])
    c.setFont("Body", 9); c.setFillColor(muted)
    c.drawString(44, 633, "Date: __________________   Guests: __________   Meal / start time: ______________")
    y = 603
    for section in kit['sections']:
        c.setFillColor(forest); c.setFont("Display", 15)
        c.drawString(44, y, section['title']); y -= 21
        for item in section['items']:
            assert stringWidth(item, "Body", 10) < 504, item
            c.setStrokeColor(gold); c.setLineWidth(.7); c.rect(45, y-1, 8, 8)
            c.setFont("Body", 10); c.setFillColor(forest); c.drawString(63, y, item)
            y -= 19
        y -= 12
    c.setFillColor(muted); c.setFont("Body", 9)
    c.drawString(44, y, "One thing to delegate: ______________________________________________________")
    y -= 22
    c.drawString(44, y, "Don't forget: ______________________________________________________________")
    footer(c, 1)
    c.showPage()
    masthead(c)
    c.setFont("Body", 9); c.drawString(44, 705, kit['name'].upper() + " EDITION | YOUR PLAN IN P&P")
    c.setFont("Display", 26); c.drawString(44, 671, "From checklist to gathering")
    c.setFillColor(muted)
    y = wrapped(c, "Start your gathering on the live Place & Plenty website. Then use these spaces to keep the details together as your plans take shape.", 44, 648)
    y -= 14
    for step in kit['steps']:
        c.setFillColor(forest)
        y = wrapped(c, step['task'], 44, y, size=14, leading=19, font="Display")
        c.setFillColor(muted)
        y = wrapped(c, step['feature'], 44, y-1, size=10, leading=16)
        y = wrapped(c, step['help'], 44, y, size=10, leading=14)
        y -= 13
    c.setFillColor(forest)
    y = wrapped(c, "Make it your own", 44, y, size=17, leading=24, font="Display")
    c.setFillColor(muted)
    y = wrapped(c, "Try one of these gathering ideas: " + "; ".join(idea['title'].lower() for idea in kit['ideas']) + ".", 44, y)
    y -= 10
    y = wrapped(c, "Your checklist is free. P&P feature access depends on your plan. Explore Free, Gathering Pass, and Plus at placeandplenty.com/pricing.", 44, y, size=9, leading=13)
    c.linkURL("https://placeandplenty.com/pricing", (44, y, 568, y+27), relative=0)
    assert y > 119, (kit['slug'], y)
    footer(c, 2)
    c.save()
    print(path.name)
