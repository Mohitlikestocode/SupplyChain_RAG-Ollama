import re
from typing import Dict, Any

SEG_TERM = None  # will be detected per text


def detect_segment_terminator(text: str) -> str:
    # common terminators: ~ or '\n'
    if '~' in text:
        return '~'
    if '\r\n' in text:
        return '\r\n'
    if '\n' in text:
        return '\n'
    return '\n'


def parse_edi(text: str) -> Dict[str, Any]:
    """Parse minimal EDI identifiers: ISA, GS, ST (transaction set id + control), BEG (PO), BIG (invoice).
    Returns dict with lists: isa, gs, st, po_numbers, invoice_numbers.
    This is a best-effort heuristic parser for X12-like EDI text.
    """
    res = {"isa": [], "gs": [], "st": [], "po_numbers": [], "invoice_numbers": []}
    if not text or len(text) < 20:
        return res
    seg_term = detect_segment_terminator(text)
    # Normalize
    # Replace newlines with segment terminator for consistent splitting
    parts = re.split(re.escape(seg_term), text)
    for p in parts:
        p = p.strip()
        if not p:
            continue
        # remove trailing newlines/spaces
        # split elements by * or | or ^
        elems = re.split(r"[\*|^]", p)
        tag = elems[0].upper()
        if tag == 'ISA':
            # ISA element positions are fixed; control number often at 13
            if len(elems) >= 14:
                res['isa'].append({'control': elems[13]})
        elif tag == 'GS':
            if len(elems) >= 7:
                res['gs'].append({'functional_identifier': elems[1], 'control': elems[6]})
        elif tag == 'ST':
            # ST*850*0001
            if len(elems) >= 3:
                res['st'].append({'set_id': elems[1], 'control': elems[2]})
        elif tag == 'BEG':
            # BEG*00*NE*PO12345**20200101
            if len(elems) >= 4:
                po = elems[3]
                if po:
                    res['po_numbers'].append(po)
        elif tag == 'BIG':
            # BIG*20200101*INV12345
            if len(elems) >= 3:
                inv = elems[2]
                if inv:
                    res['invoice_numbers'].append(inv)
        # also look for REF* (reference) segments that might contain PO or invoice refs
        elif tag == 'REF':
            if len(elems) >= 3:
                refid = elems[2]
                if refid:
                    # Heuristic: if REF qualifier indicates PO or IV, add
                    qual = elems[1].upper() if len(elems) >= 2 else ''
                    if qual in ('PO', 'VN', 'DP', 'IV', 'F1'):
                        # treat as invoice or PO
                        if qual in ('PO', 'DP'):
                            res['po_numbers'].append(refid)
                        else:
                            res['invoice_numbers'].append(refid)
        elif tag == 'N1':
            # Party name: N1*ST*Company Name*92*ID
            if len(elems) >= 3:
                party = elems[2]
                qual = elems[1] if len(elems) >= 2 else ''
                if party:
                    res.setdefault('parties', []).append({'qual': qual, 'name': party})
        elif tag == 'DTM':
            # Date/time qualifier: DTM*011*20200101
            if len(elems) >= 3:
                q = elems[1]
                dt = elems[2]
                res.setdefault('dates', []).append({'qual': q, 'date': dt})
        elif tag == 'N9':
            # Free-form reference: N9*PO*12345
            if len(elems) >= 3:
                qual = elems[1]
                val = elems[2]
                if val:
                    res.setdefault('refs', []).append({'qual': qual, 'value': val})
        elif tag == 'IT1':
            # Line item: IT1*1*5*EA*10.00*VC*ITEM123
            if len(elems) >= 7:
                item = elems[6]
                if item:
                    res.setdefault('items', []).append(item)
    # dedupe
    for k in res:
        seen = set()
        out = []
        for v in res[k]:
            if isinstance(v, dict):
                tup = tuple(sorted(v.items()))
            else:
                tup = v
            if tup in seen:
                continue
            seen.add(tup)
            out.append(v)
        res[k] = out
    return res
