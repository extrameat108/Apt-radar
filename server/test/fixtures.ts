export interface RawItem {
  aptNm: string;
  aptSeq: string;
  dealAmount: string;
  dealYear: string;
  dealMonth: string;
  dealDay: string;
  excluUseAr: string;
  floor: string;
  sggCd?: string;
  umdNm?: string;
  dealingGbn?: string;
  buyerGbn?: string;
  slerGbn?: string;
  cdealType?: string;
  cdealDay?: string;
  buildYear?: string;
}

export function item(p: Partial<RawItem> & Pick<RawItem, 'aptSeq' | 'dealAmount'>): RawItem {
  return {
    aptNm: '테스트아파트',
    dealYear: '2026',
    dealMonth: '10',
    dealDay: '15',
    excluUseAr: '84.97',
    floor: '10',
    sggCd: '11650',
    umdNm: '반포동',
    dealingGbn: '중개거래',
    buyerGbn: '개인',
    slerGbn: '개인',
    cdealType: '',
    cdealDay: '',
    buildYear: '2019',
    ...p,
  };
}

/** 국토부 API 응답과 같은 구조의 XML */
export function xmlOf(items: RawItem[], totalCount = items.length, pageNo = 1): string {
  const body = items
    .map(
      (it) =>
        '<item>' +
        Object.entries(it)
          .map(([k, v]) => `<${k}>${v}</${k}>`)
          .join('') +
        '</item>',
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>${body}</items><numOfRows>1000</numOfRows><pageNo>${pageNo}</pageNo><totalCount>${totalCount}</totalCount></body></response>`;
}
