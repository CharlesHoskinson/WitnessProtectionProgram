# -*- coding: utf-8 -*-
import html, os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
                                Table, TableStyle, KeepTogether, PageBreak, Flowable,
                                NextPageTemplate, Image)
import theme
from theme import (BG, PANEL, ELEV, BORDER, TEXT, MUTED, DIM, ORANGE, ORANGE_HI,
                   CYAN, VIOLET, ACC_FG, EntropyChart, StatTile, PathsDiagram)
from content import TITLE, SUBTITLE, DATE, STATUS, SECTIONS, EVIDENCE, CAVEATS

theme.register_fonts()
HERE = os.path.dirname(os.path.abspath(__file__))
ART = lambda n: os.path.join(HERE, "..", "art", n)

PW, PH = A4
LM = RM = 21*mm; TM = 19*mm; BM = 19*mm
AVAIL = PW - LM - RM

def S(n, **kw):
    b = dict(name=n, fontName="Inter", fontSize=9.4, leading=14.4, textColor=colors.HexColor("#d5dbe3"))
    b.update(kw); return ParagraphStyle(**b)

st_title = S("t", fontName="Inter-B", fontSize=30, leading=34, textColor=TEXT)
st_htitle = S("ht", fontName="Inter-B", fontSize=23, leading=27, textColor=TEXT)
st_sub   = S("s", fontSize=12.6, leading=17.5, textColor=colors.HexColor("#9aa6b4"))
st_meta  = S("m", fontName="Mono", fontSize=7.8, leading=12, textColor=MUTED)
st_h2    = S("h2", fontName="Inter-B", fontSize=15, leading=19, textColor=TEXT)
st_kick  = S("k", fontName="Mono-M", fontSize=7.4, leading=10, textColor=ORANGE)
st_h3    = S("h3", fontName="Inter-SB", fontSize=10.4, leading=14.5, textColor=colors.HexColor("#e8edf3"))
st_body  = S("p")
st_lead  = S("l", fontSize=11, leading=17, textColor=colors.HexColor("#e2e8ef"))
st_bul   = S("b", leftIndent=11, firstLineIndent=-11)
st_quote = S("q", fontSize=9.2, leading=14.2, leftIndent=9, rightIndent=6,
             textColor=colors.HexColor("#bcd4ea"))
st_code  = S("c", fontName="Mono", fontSize=7.7, leading=11.6, leftIndent=6, rightIndent=4,
             textColor=colors.HexColor("#b9c6d4"))
st_note  = S("n", fontSize=8.8, leading=13.2, leftIndent=8, rightIndent=8,
             textColor=colors.HexColor("#cfd9e4"))
st_th    = S("th", fontName="Inter-SB", fontSize=8.3, leading=11.4, textColor=colors.HexColor("#0a0f16"))
st_td    = S("td", fontSize=8.4, leading=11.8, textColor=colors.HexColor("#ccd4dd"))
st_tdb   = S("tdb", fontName="Inter-SB", fontSize=8.4, leading=11.8, textColor=TEXT)
st_tdc   = S("tdc", fontSize=7.7, leading=10.4, textColor=colors.HexColor("#ccd4dd"))
st_tdbc  = S("tdbc", fontName="Inter-SB", fontSize=7.7, leading=10.4, textColor=TEXT)

class Rule(Flowable):
    def __init__(self, w=None, color=BORDER, thick=0.6):
        Flowable.__init__(self); self.color=color; self.thick=thick
    def wrap(self, aw, ah): self.width=aw; return (aw, self.thick+1)
    def draw(self):
        self.canv.setStrokeColor(self.color); self.canv.setLineWidth(self.thick)
        self.canv.line(0,0,self.width,0)

class Band(Flowable):
    """Full-bleed art strip with a fade into the page background."""
    def __init__(self, path, h=34*mm):
        Flowable.__init__(self); self.path=path; self.h=h
    def wrap(self, aw, ah): self.width=aw; return (aw, self.h)
    def draw(self):
        c=self.canv
        c.saveState()
        p=c.beginPath(); p.rect(0,0,self.width,self.h); c.clipPath(p, stroke=0)
        img=ImageReader(self.path); iw,ih=img.getSize()
        sc=max(self.width/iw, self.h/ih)
        c.drawImage(img, (self.width-iw*sc)/2, (self.h-ih*sc)/2, iw*sc, ih*sc, mask='auto')
        # edge fades
        steps=26
        for i in range(steps):
            a=(i/steps)**1.5
            c.setFillColor(colors.Color(0,0,0,alpha=1-a))
            c.rect(0, self.h-(i+1)*1.1, self.width, 1.2, stroke=0, fill=1)
            c.rect(0, i*1.1, self.width, 1.2, stroke=0, fill=1)
        c.restoreState()
        c.setStrokeColor(BORDER); c.setLineWidth(0.5)
        c.line(0,0,self.width,0); c.line(0,self.h,self.width,self.h)

def P(t, s=st_body): return Paragraph(t, s)

def mktable(header, rows, avail, weights=None, compact=False):
    n=len(header)
    if weights is None:
        weights=[1.0]*n
        if n==3: weights=[0.9,1.45,1.65]
        if n==2: weights=[0.85,2.15]
    tot=sum(weights); cw=[avail*w/tot for w in weights]
    data=[[P(html.escape(h), st_th) for h in header]]
    for r in rows:
        row=[]
        for i,cell in enumerate(r):
            if compact: sty = st_tdbc if i==0 and n>2 else st_tdc
            else:       sty = st_tdb  if i==0 and n>2 else st_td
            row.append(P(cell, sty))
        data.append(row)
    t=Table(data, colWidths=cw, repeatRows=1, hAlign="LEFT")
    pad = 3.2 if compact else 5
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0), ORANGE),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("TOPPADDING",(0,0),(-1,-1),pad),("BOTTOMPADDING",(0,0),(-1,-1),pad),
        ("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),6),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[PANEL, ELEV]),
        ("LINEBELOW",(0,0),(-1,-1),0.35, BORDER),
        ("LINEAFTER",(0,0),(-2,-1),0.35, BORDER),
        ("BOX",(0,0),(-1,-1),0.5, BORDER),
    ]))
    return t

def boxed(txt, avail, style, bg, edge, accent=None):
    t=Table([[P(txt, style)]], colWidths=[avail], hAlign="LEFT")
    cmds=[("BACKGROUND",(0,0),(-1,-1),bg),("BOX",(0,0),(-1,-1),0.6,edge),
          ("LEFTPADDING",(0,0),(-1,-1),10),("RIGHTPADDING",(0,0),(-1,-1),10),
          ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8),
          ("VALIGN",(0,0),(-1,-1),"TOP")]
    if accent: cmds.append(("LINEBEFORE",(0,0),(0,-1),2.2,accent))
    t.setStyle(TableStyle(cmds)); return t

notebox  = lambda t,a: boxed(t,a,st_note, ELEV, BORDER, ORANGE)
quotebox = lambda t,a: boxed("&#8220;"+t+"&#8221;", a, st_quote, PANEL, BORDER, CYAN)
codebox  = lambda t,a: boxed("<br/>".join(html.escape(l) if l.strip() else "&nbsp;"
                                          for l in t.split("\n")), a, st_code, PANEL, BORDER)

def paint_bg(canv, doc):
    canv.saveState(); canv.setFillColor(BG); canv.rect(0,0,PW,PH,stroke=0,fill=1); canv.restoreState()

def on_body(canv, doc):
    paint_bg(canv, doc)
    canv.saveState()
    canv.setFont("Mono",6.8); canv.setFillColor(MUTED)
    canv.drawString(LM, BM-9, "PORTABLE PASSPORT · DESIGN PROPOSAL")
    canv.setFillColor(ORANGE); canv.drawRightString(PW-RM, BM-9, "%02d" % doc.page)
    canv.setStrokeColor(BORDER); canv.setLineWidth(0.4)
    canv.line(LM, BM-4, PW-RM, BM-4)
    canv.restoreState()

def on_cover(canv, doc):
    paint_bg(canv, doc)
    canv.saveState()
    img=ImageReader(ART("cover.png")); iw,ih=img.getSize()
    bh=PH*0.46; sc=max(PW/iw, bh/ih)
    canv.saveState()
    p=canv.beginPath(); p.rect(0,PH-bh,PW,bh); canv.clipPath(p,stroke=0)
    canv.drawImage(img,(PW-iw*sc)/2, PH-bh+(bh-ih*sc)/2, iw*sc, ih*sc, mask='auto')
    canv.restoreState()
    for i in range(70):
        a=(i/70)**1.4
        canv.setFillColor(colors.Color(0,0,0,alpha=1-a))
        canv.rect(0, PH-bh+i*1.3, PW, 1.4, stroke=0, fill=1)
    canv.setFillColor(ORANGE); canv.rect(0, PH-2.2*mm, PW, 2.2*mm, stroke=0, fill=1)
    canv.restoreState()

doc=BaseDocTemplate(os.path.join(HERE,"..","portable-passport-proposal.pdf"), pagesize=A4,
                    leftMargin=LM,rightMargin=RM,topMargin=TM,bottomMargin=BM,
                    title="Portable Passport - design proposal",
                    author="Charles Hoskinson",
                    subject="Encrypted export and human-recoverable backup for Midnight Passport")
frame=Frame(LM,BM,AVAIL,PH-TM-BM,id="b",leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
doc.addPageTemplates([PageTemplate(id="cover",frames=[frame],onPage=on_cover),
                      PageTemplate(id="body",frames=[frame],onPage=on_body)])
F=[]
# ---------------- COVER ----------------
F += [Spacer(1, PH*0.46-TM-6*mm),
      P("MIDNIGHT PASSPORT · WITNESS PROTECTION PROGRAM", st_kick), Spacer(1,3.5*mm),
      P(TITLE, st_title), Spacer(1,2.5*mm), P(SUBTITLE, st_sub), Spacer(1,5*mm),
      Rule(color=ORANGE, thick=1.4), Spacer(1,4*mm),
      P("DESIGN PROPOSAL &nbsp;&#183;&nbsp; " + DATE.upper(), st_meta), Spacer(1,7*mm),
      notebox(STATUS, AVAIL)]

# ---------------- EXEC SUMMARY ----------------
F += [NextPageTemplate("body"), PageBreak()]
F += [P("EXECUTIVE SUMMARY", st_kick), Spacer(1,2*mm),
      P("The human cannot hold the key.<br/>They can only release it.", st_htitle), Spacer(1,3*mm),
      Rule(color=ORANGE, thick=1.2), Spacer(1,3.6*mm),
      P("Passport links a wallet to a passkey on a phone. We want that identity portable, and the "
        "private state the chain cannot rebuild backed up through WPP into the user's own Google "
        "Drive, encrypted before it leaves the device. The open question was what an ordinary "
        "person can do to decrypt it again.", st_lead), Spacer(1,3.4*mm)]
F += [P("What the evidence settles", st_h3), Spacer(1,2*mm),
      P("Eight research streams agree on one thing: <b>no secret a human holds in their head, "
        "recognises on a screen, or knows about their own life can carry a 256-bit key.</b> The "
        "measured ceiling is about 56 bits with rehearsal, and below 30 set-once. A key-derivation "
        "function buys roughly 25 bits once the ciphertext is downloadable — so a PIN plus an "
        "image puzzle is worth about $200 of rented GPU.", st_body),
      Spacer(1,2.6*mm), EntropyChart(AVAIL), Spacer(1,2.6*mm),
      StatTile(AVAIL, "256", "bits", "WebAuthn PRF, biometric-gated",
               "off the scale above · the only factor that clears the bar", CYAN),
      Spacer(1,5*mm)]
F += [P("What we propose", st_h3), Spacer(1,2*mm),
      P("Three independent release paths, any one of which recovers the backup. The PIN and image "
        "puzzle stay — but only inside the device path, where the secure element rate-limits "
        "them for free. They never stand alone in front of a downloadable ciphertext.", st_body),
      Spacer(1,3*mm),
      mktable(["Path","What the human does","Carries the bits"],
              [["E1 \u00b7 Device","Touch the phone","WebAuthn PRF \u2014 256 bits"],
               ["E2 \u00b7 Helpers","Ask 2 of 3 trusted people","Threshold shares \u2014 no human secret"],
               ["E3 \u00b7 Escrow","Scan a printed QR code","128+ bit code \u2014 bonus path only"]],
              AVAIL, weights=[0.62,1.30,1.30]), Spacer(1,3.4*mm),
      notebox("<b>Three things outrank this proposal and do not depend on it:</b> "
              "<font color='#ff7c4d'>1.</font> account_custody.compact recover() has no timelock. "
              "<font color='#ff7c4d'>2.</font> The contract's own comment says the recovery shares "
              "are readable by anyone — “Do not ship.” "
              "<font color='#ff7c4d'>3.</font> DeRec is named as the recovery mechanism but sits at "
              "v0.0.2 with two archived repos and no audit.", AVAIL)]

# ---------------- BODY ----------------
ART_FOR = {"3. Six findings that constrain any design": "entropy.png",
           "4. The proposal": "paths.png"}
for idx,(heading, blocks) in enumerate(SECTIONS):
    F.append(PageBreak() if heading in ART_FOR or idx==0 else Spacer(1,7*mm))
    if heading in ART_FOR:
        F += [Band(ART(ART_FOR[heading]), 30*mm), Spacer(1,5*mm)]
    num, _, rest = heading.partition(". ")
    F.append(KeepTogether([P("SECTION " + num, st_kick), Spacer(1,1.6*mm),
                           P(html.escape(rest), st_h2), Spacer(1,1.8*mm),
                           Rule(color=ORANGE, thick=1.0), Spacer(1,3.6*mm)]))
    if heading.startswith("4."):
        F += [PathsDiagram(AVAIL), Spacer(1,5*mm)]
    for kind,payload in blocks:
        if kind=="p":      F += [P(payload), Spacer(1,3.1*mm)]
        elif kind=="h3":   F += [Spacer(1,2.2*mm), KeepTogether([P(payload, st_h3), Spacer(1,2.2*mm)])]
        elif kind=="b":
            for it in payload: F += [P("<font color='#e85d2c'>&#9642;</font>&nbsp;&nbsp;"+it, st_bul), Spacer(1,2.0*mm)]
            F.append(Spacer(1,1.4*mm))
        elif kind=="t":
            h,rows=payload; F += [Spacer(1,0.6*mm), mktable(h,rows,AVAIL), Spacer(1,4.2*mm)]
        elif kind=="code":  F += [codebox(payload,AVAIL), Spacer(1,4.0*mm)]
        elif kind=="quote": F += [quotebox(payload,AVAIL), Spacer(1,4.0*mm)]
        elif kind=="note":  F += [notebox(payload,AVAIL), Spacer(1,4.2*mm)]

# ---------------- APPENDICES ----------------
F.append(PageBreak())
F += [P("APPENDIX A", st_kick), Spacer(1,1.6*mm), P("Evidence", st_h2), Spacer(1,1.8*mm),
      Rule(color=ORANGE, thick=1.0), Spacer(1,3.6*mm),
      P("Every load-bearing figure in this proposal, with its source. Cost figures in section 3 are "
        "derived arithmetic over cited anchor benchmarks and are marked as such in Appendix B.",
        st_body), Spacer(1,3.5*mm),
      mktable(["Claim","Figure","Source"], [[a,b,c] for a,b,c in EVIDENCE], AVAIL,
              weights=[0.78,1.62,1.10], compact=True)]
F.append(PageBreak())
F += [P("APPENDIX B", st_kick), Spacer(1,1.6*mm), P("Provenance and caveats", st_h2),
      Spacer(1,1.8*mm), Rule(color=ORANGE, thick=1.0), Spacer(1,3.6*mm)]
for h,body in CAVEATS:
    F += [KeepTogether([P(html.escape(h), st_h3), Spacer(1,1.6*mm), P(body)]), Spacer(1,4.2*mm)]

doc.build(F)
print("built", os.path.abspath(os.path.join(HERE,"..","portable-passport-proposal.pdf")))
