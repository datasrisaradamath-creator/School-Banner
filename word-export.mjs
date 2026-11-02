const encoder = new TextEncoder();
const xml = value => String(value).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));

// Store-mode ZIP keeps Word export self-contained, including when offline.
function zip(files) {
  const parts = [], directory = []; let offset = 0;
  const header = size => new DataView(new ArrayBuffer(size));
  for (const [name, value] of files) {
    const data = typeof value === 'string' ? encoder.encode(value) : value;
    const filename = encoder.encode(name);
    let crc = 0xffffffff;
    for (const byte of data) { crc ^= byte; for (let i=0;i<8;i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = header(30); local.setUint32(0,0x04034b50,true); local.setUint16(4,20,true);
    local.setUint32(14,crc,true); local.setUint32(18,data.length,true); local.setUint32(22,data.length,true); local.setUint16(26,filename.length,true);
    parts.push(local.buffer, filename, data);
    const central = header(46); central.setUint32(0,0x02014b50,true); central.setUint16(4,20,true); central.setUint16(6,20,true);
    central.setUint32(16,crc,true); central.setUint32(20,data.length,true); central.setUint32(24,data.length,true); central.setUint16(28,filename.length,true); central.setUint32(42,offset,true);
    directory.push(central.buffer,filename); offset += 30 + filename.length + data.length;
  }
  const directorySize = directory.reduce((sum,item)=>sum+(item.byteLength),0);
  const end = header(22); end.setUint32(0,0x06054b50,true); end.setUint16(8,files.length,true); end.setUint16(10,files.length,true); end.setUint32(12,directorySize,true); end.setUint32(16,offset,true);
  return new Blob([...parts,...directory,end.buffer],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}


export function downloadDesignsDocx(images) {
  const files = [], rels = [], groups = [];
  images.forEach((image, index) => {
    image = { ...image, mediaId: index + 1, anchor: `design_${index + 1}` };
    files.push([`word/media/image${image.mediaId}.png`, Uint8Array.from(atob(image.data.split(',')[1]), c => c.charCodeAt(0))]);
    rels.push(`<Relationship Id="rId${image.mediaId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${image.mediaId}.png"/>`);
    let group = groups.find(item => item.id === image.choiceId);
    if (!group) { group = { id: image.choiceId, name: image.choiceName || image.name, images: [] }; groups.push(group); }
    group.images.push(image);
  });
  let bookmarkId = 0;
  const bookmark = anchor => `<w:bookmarkStart w:id="${++bookmarkId}" w:name="${anchor}"/><w:bookmarkEnd w:id="${bookmarkId}"/>`;
  const paragraph = (text, size = 20, bold = false) => `<w:p><w:pPr><w:spacing w:before="0" w:after="100" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="${size}"/>${bold ? '<w:b/>' : ''}</w:rPr><w:t>${xml(text)}</w:t></w:r></w:p>`;
  let drawingId = 0;
  const picture = (image, maxWidth, maxHeight, anchorLink = false) => {
    const width = Math.min(maxWidth, maxHeight * image.width / image.height);
    const height = width * image.height / image.width;
    const cx = Math.round(width * 914400), cy = Math.round(height * 914400);
    const drawing = `<w:r><w:drawing><wp:inline><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${++drawingId}" name="Design ${drawingId}" descr="${xml(image.name)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${drawingId}" name="Design"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId${image.mediaId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
    return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="80"/></w:pPr>${anchorLink ? `<w:hyperlink w:anchor="${image.anchor}">${drawing}</w:hyperlink>` : drawing}</w:p>`;
  };
  const pageBreak = '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>';
  let body = paragraph('School Banner Saved Choices', 36, true) + paragraph('Thumbnail index', 28, true) + paragraph('Select a Heritage thumbnail to jump to that saved choice.');
  for (const group of groups) {
    const heritage = group.images.find(image => image.layout === 'arched') || group.images[0];
    body += paragraph(group.name, 24, true);
    body += picture(heritage, 1.8, 1.2, true);
  }
  body += pageBreak;
  let groupIndex = 0;
  for (const group of groups) {
    if (groupIndex++) body += pageBreak;
    const heritage = group.images.find(i => i.layout === 'arched') || group.images[0];
    const square = group.images.find(i => i.layout === 'top');
    const banners = group.images.filter(i => i !== heritage && i !== square);
    const metadata = paragraph(group.name, 28, true) + paragraph('Saved settings', 22, true) + (heritage.metadata || []).map(detail => paragraph(detail)).join('');
    body += metadata + '<w:p><w:pPr><w:spacing w:after="0" w:line="700" w:lineRule="exact"/></w:pPr><w:r><w:t> </w:t></w:r></w:p>';
    body += bookmark(heritage.anchor) + paragraph(heritage.layoutName, 20, true) + picture(heritage, 6.5, 4.4);
    if (banners[0]) body += bookmark(banners[0].anchor) + paragraph(banners[0].layoutName, 20, true) + picture(banners[0], 6.5, 1.1);
    body += pageBreak;
    if (square) body += bookmark(square.anchor) + paragraph(`${group.name} — ${square.layoutName}`, 20, true) + picture(square, 6.5, 6.5);
    for (const image of banners.slice(1)) body += bookmark(image.anchor) + paragraph(image.layoutName, 20, true) + picture(image, 6.5, 1.1);
  }
  files.push(['[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>']);
  files.push(['_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>']);
  files.push(['word/_rels/document.xml.rels',`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`]);
  files.push(['word/document.xml',`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="1440" w:bottom="720" w:left="1440"/></w:sectPr></w:body></w:document>`]);
  const url = URL.createObjectURL(zip(files)); const link = document.createElement('a'); link.href = url; link.download = 'school-banner-saved-choices.docx'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
