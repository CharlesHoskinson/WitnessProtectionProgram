# -*- coding: utf-8 -*-
"""Midnight.city design tokens + vector diagram flowables for the proposal PDF."""
import os
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import Flowable
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont as RLTTFont

FONTDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fonts")

def register_fonts():
    reg = [("Inter", "Inter-Regular.ttf"), ("Inter-SB", "Inter-SemiBold.ttf"),
           ("Inter-B", "Inter-Bold.ttf"), ("Mono", "GeistMono-Regular.ttf"),
           ("Mono-M", "GeistMono-Medium.ttf")]
    for name, fn in reg:
        pdfmetrics.registerFont(RLTTFont(name, os.path.join(FONTDIR, fn)))
    pdfmetrics.registerFontFamily("Inter", normal="Inter", bold="Inter-B",
                                  italic="Inter", boldItalic="Inter-B")

# --- tokens, lifted from midnight.city ---
BG      = colors.HexColor("#000000")
PANEL   = colors.HexColor("#000f1e")
ELEV    = colors.HexColor("#0a1322")
BORDER  = colors.HexColor("#292f39")
TEXT    = colors.HexColor("#ffffff")
MUTED   = colors.HexColor("#6e7889")
DIM     = colors.HexColor("#8c8c8c")
ORANGE  = colors.HexColor("#e85d2c")
ORANGE_HI = colors.HexColor("#ff7c4d")
CYAN    = colors.HexColor("#76c8ff")
VIOLET  = colors.HexColor("#a984ff")
BLUE    = colors.HexColor("#3b82f6")   # validated vs ORANGE, dark band
ACC_BG  = colors.HexColor("#19344d")
ACC_FG  = colors.HexColor("#e0f0ff")

def _t(c, a):
    """Blend colour c toward the black page background by alpha a."""
    return colors.Color(c.red*a, c.green*a, c.blue*a)


class EntropyChart(Flowable):
    """Horizontal bars: measured human-factor strength against the 64-bit requirement.
    Single hue + labelled threshold rule (no status-colour misuse); every bar direct-labelled."""
    ROWS = [("WebAuthn PRF (device)", 256, True),
            ("Requirement, offline-attackable", 64, None),
            ("Memorised, with rehearsal", 56, False),
            ("Set-once memory ceiling", 30, False),
            ("PIN + image puzzle", 33, False),
            ("Image puzzle alone", 10, False),
            ("6-digit PIN alone", 11, False)]

    def __init__(self, width, height=58*mm):
        Flowable.__init__(self); self.width = width; self.height = height

    def wrap(self, aw, ah):
        self.width = aw; return (aw, self.height)

    def draw(self):
        c = self.canv
        W, H = self.width, self.height
        # panel
        c.setFillColor(PANEL); c.setStrokeColor(BORDER); c.setLineWidth(0.6)
        c.roundRect(0, 0, W, H, 3, stroke=1, fill=1)

        padL, padR, padT, padB = 58*mm, 15*mm, 14.5*mm, 9.5*mm
        plotW = W - padL - padR
        MAXV = 72.0

        bars = [r for r in self.ROWS if r[1] <= MAXV and r[2] is False]
        thresh = 64

        c.setFont("Inter-SB", 8.4); c.setFillColor(TEXT)
        c.drawString(8*mm, H - 7.5*mm, "Measured strength of human-held secrets")
        c.setFont("Inter", 7.2); c.setFillColor(MUTED)
        c.drawString(10*mm, H - 13*mm, "bits of guessing entropy · measured, not theoretical")

        n = len(bars)
        avail = H - padT - padB
        step = avail / n
        bh = min(5.2*mm, step*0.55)

        # gridlines
        c.setStrokeColor(_t(BORDER, 0.85)); c.setLineWidth(0.4)
        for g in (0, 16, 32, 48, 64):
            x = padL + plotW*g/MAXV
            c.line(x, padB - 2.5*mm, x, H - padT + 2*mm)
            c.setFont("Mono", 6.2); c.setFillColor(_t(MUTED, 0.9))
            c.drawCentredString(x, padB - 5.4*mm, str(g))

        # bars
        for i, (label, val, _) in enumerate(bars):
            yc = H - padT - (i + 0.5)*step
            y = yc - bh/2
            c.setFont("Inter", 7.8); c.setFillColor(colors.HexColor("#c9d1dc"))
            c.drawRightString(padL - 5*mm, yc - 2.5, label)
            w = plotW*val/MAXV
            c.setFillColor(ORANGE)
            c.roundRect(padL, y, max(w, 1.2), bh, 1.6, stroke=0, fill=1)
            c.setFont("Mono-M", 7.4); c.setFillColor(ORANGE_HI)
            c.drawString(padL + w + 2.4*mm, yc - 2.4, str(val))

        # threshold rule
        xt = padL + plotW*thresh/MAXV
        c.setStrokeColor(CYAN); c.setLineWidth(1.1); c.setDash(3, 2)
        c.line(xt, padB - 2.5*mm, xt, H - padT + 4.5*mm)
        c.setDash()
        c.setFont("Inter-SB", 7.0); c.setFillColor(CYAN)
        c.drawRightString(xt - 2*mm, H - padT + 5.6*mm, "64-bit requirement")
        c.setFont("Inter", 6.6); c.setFillColor(_t(CYAN, 0.75))
        c.drawRightString(xt - 2*mm, H - padT + 2.4*mm, "nothing human-held reaches it")


class StatTile(Flowable):
    def __init__(self, width, value, unit, label, sub, accent=CYAN, height=16.5*mm):
        Flowable.__init__(self); self.width=width; self.height=height
        self.value=value; self.unit=unit; self.label=label; self.sub=sub; self.accent=accent
    def wrap(self, aw, ah):
        self.width=aw; return (aw, self.height)
    def draw(self):
        c=self.canv; W,H=self.width,self.height
        c.setFillColor(ELEV); c.setStrokeColor(BORDER); c.setLineWidth(0.6)
        c.roundRect(0,0,W,H,3,stroke=1,fill=1)
        c.setFillColor(self.accent); c.rect(0,0,1.6,H,stroke=0,fill=1)
        c.setFont("Mono-M", 18); c.setFillColor(self.accent)
        c.drawString(6*mm, H-10*mm, self.value)
        vw = pdfmetrics.stringWidth(self.value, "Mono-M", 18)
        c.setFont("Inter", 8.4); c.setFillColor(MUTED)
        c.drawString(6*mm+vw+2*mm, H-10*mm, self.unit)
        c.setFont("Inter-SB", 8.2); c.setFillColor(TEXT)
        c.drawString(6*mm, H-14.2*mm, self.label)
        c.setFont("Inter", 7.2); c.setFillColor(MUTED)
        c.drawRightString(W-6*mm, H-14.2*mm, self.sub)


class PathsDiagram(Flowable):
    """The three release paths, drawn as the spec rather than as art."""
    COLS = [("E1", "Device", "Touch the phone", "WebAuthn PRF", "256 bits", ORANGE,
             "biometric gates it;\nsecure element\nrate-limits for free"),
            ("E2", "Helpers", "Ask 2 of 3 people", "Threshold shares", "no human secret", CYAN,
             "PVSS shares + time\ndelay with owner veto;\n17/19 measured"),
            ("E3", "Escrow", "Scan a printed QR", "128+ bit code", "bonus path", VIOLET,
             "only 5.7% of users\never print; never\nthe plan")]

    def __init__(self, width, height=80*mm):
        Flowable.__init__(self); self.width=width; self.height=height
    def wrap(self, aw, ah):
        self.width=aw; return (aw, self.height)
    def draw(self):
        c=self.canv; W,H=self.width,self.height
        c.setFillColor(PANEL); c.setStrokeColor(BORDER); c.setLineWidth(0.6)
        c.roundRect(0,0,W,H,3,stroke=1,fill=1)

        c.setFont("Inter-SB", 8.4); c.setFillColor(TEXT)
        c.drawString(8*mm, H-7.5*mm, "Three release paths \u00b7 any one recovers the backup")
        c.setFont("Inter", 7.0); c.setFillColor(MUTED)
        c.drawString(8*mm, H-11.2*mm, "threshold, never conjunction \u2014 ANDing three human factors locks out 63\u201377%")

        pad=8*mm; gap=4.5*mm
        colw=(W-2*pad-2*gap)/3
        boxT=H-15.5*mm; boxH=41*mm; boxB=boxT-boxH
        tgtH=9*mm; tgtY=6*mm; tgtTop=tgtY+tgtH

        for i,(tag,name,action,carrier,bits,col,note) in enumerate(self.COLS):
            x=pad+i*(colw+gap)
            c.setFillColor(ELEV); c.setStrokeColor(_t(col,0.55)); c.setLineWidth(0.8)
            c.roundRect(x, boxB, colw, boxH, 2.5, stroke=1, fill=1)
            c.setFillColor(col); c.rect(x, boxT-1.4*mm, colw, 1.4*mm, stroke=0, fill=1)
            c.setFont("Mono-M", 7.4); c.setFillColor(col)
            c.drawString(x+4*mm, boxT-7.5*mm, tag)
            c.setFont("Inter-B", 9.2); c.setFillColor(TEXT)
            c.drawString(x+4*mm+8.5*mm, boxT-7.5*mm, name)
            c.setFont("Inter", 7.6); c.setFillColor(colors.HexColor("#c9d1dc"))
            c.drawString(x+4*mm, boxT-14.5*mm, action)
            c.setStrokeColor(BORDER); c.setLineWidth(0.5)
            c.line(x+4*mm, boxT-17.5*mm, x+colw-4*mm, boxT-17.5*mm)
            c.setFont("Inter-SB", 7.3); c.setFillColor(col)
            c.drawString(x+4*mm, boxT-22.5*mm, carrier)
            c.setFont("Mono", 6.6); c.setFillColor(MUTED)
            c.drawString(x+4*mm, boxT-26.8*mm, bits)
            c.setFont("Inter", 6.4); c.setFillColor(_t(MUTED,1.0))
            for j,ln in enumerate(note.split("\n")):
                c.drawString(x+4*mm, boxT-31.5*mm-j*3.0*mm, ln)
            cx=x+colw/2
            mid=(boxB+tgtTop)/2
            c.setStrokeColor(_t(col,0.8)); c.setLineWidth(0.9)
            c.line(cx, boxB-1.2*mm, cx, mid)
            c.line(cx, mid, W/2, mid)
        c.setStrokeColor(_t(ORANGE_HI,0.8)); c.setLineWidth(0.9)
        c.line(W/2, (boxB+tgtTop)/2, W/2, tgtTop)

        c.setFillColor(ELEV); c.setStrokeColor(ORANGE_HI); c.setLineWidth(0.9)
        bw=64*mm
        c.roundRect(W/2-bw/2, tgtY, bw, tgtH, 2, stroke=1, fill=1)
        c.setFont("Mono-M", 7.6); c.setFillColor(ORANGE_HI)
        c.drawCentredString(W/2, tgtY+3.3*mm, "recoveryKey  \u00b7  32 bytes")
