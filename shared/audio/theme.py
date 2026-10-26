"""Original C-major, 120-BPM Office Cast theme; not a pre-rendered BGM file."""

NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}

def nm(tok):
    if tok == "-":
        return None
    return 12 * (int(tok[-1]) + 1) + NOTE[tok[0]] + (1 if "#" in tok else 0)

def row(s):
    v = s.split()
    assert len(v) == 8, s
    return [nm(x) for x in v]

MEL = [row(s) for s in [
    "C5 - E5 G5 - E5 C5 -", "A4 - C5 E5 - C5 A4 -", "F4 - A4 C5 - D5 C5 A4", "B4 - D5 G5 - - G4 -",
    "C5 - E5 G5 - E5 C5 -", "B4 - E5 G5 - E5 B4 -", "A4 C5 F5 A5 - G5 F5 D5", "G5 - F5 - D5 - B4 -",
    "A5 - A5 - G5 - F5 -", "G5 - G5 - F5 - E5 -", "E5 - G5 - B5 - G5 -", "A5 - E5 - C5 - A4 -",
    "D5 F5 A5 - F5 D5 A4 -", "B4 D5 G5 - D5 B4 G4 -", "C5 - G4 - E5 - C5 -", "C5 - - - G4 - G4 -",
]]

PROG = ["C", "Am", "F", "G", "C", "Em", "F", "G7", "F", "G", "Em", "Am", "Dm", "G", "C", "C"]

CH = {"C": ([60, 64, 67], 36), "Am": ([57, 60, 64], 33), "F": ([57, 60, 65], 41), "G": ([55, 59, 62], 43),
      "Em": ([55, 59, 64], 40), "Dm": ([57, 62, 65], 38), "G7": ([55, 59, 65], 43)}
