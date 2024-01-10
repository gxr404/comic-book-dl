import crypto from 'node:crypto'
import protobuf from 'protobufjs'

const key = 'MIICeAIBADANBgkqhkiG9w0BAQEFAASCAmIwggJeAgEAAoGBAK8nNR1lTnIfIes6oRWJNj3mB6OssDGx0uGMpgpbVCpf6+VwnuI2stmhZNoQcM417Iz7WqlPzbUmu9R4dEKmLGEEqOhOdVaeh9Xk2IPPjqIu5TbkLZRxkY3dJM1htbz57d/roesJLkZXqssfG5EJauNc+RcABTfLb4IiFjSMlTsnAgMBAAECgYEAiz/pi2hKOJKlvcTL4jpHJGjn8+lL3wZX+LeAHkXDoTjHa47g0knYYQteCbv+YwMeAGupBWiLy5RyyhXFoGNKbbnvftMYK56hH+iqxjtDLnjSDKWnhcB7089sNKaEM9Ilil6uxWMrMMBH9v2PLdYsqMBHqPutKu/SigeGPeiB7VECQQDizVlNv67go99QAIv2n/ga4e0wLizVuaNBXE88AdOnaZ0LOTeniVEqvPtgUk63zbjl0P/pzQzyjitwe6HoCAIpAkEAxbOtnCm1uKEp5HsNaXEJTwE7WQf7PrLD4+BpGtNKkgja6f6F4ld4QZ2TQ6qvsCizSGJrjOpNdjVGJ7bgYMcczwJBALvJWPLmDi7ToFfGTB0EsNHZVKE66kZ/8Stx+ezueke4S556XplqOflQBjbnj2PigwBN/0afT+QZUOBOjWzoDJkCQClzo+oDQMvGVs9GEajS/32mJ3hiWQZrWvEzgzYRqSf3XVcEe7PaXSd8z3y3lACeeACsShqQoc8wGlaHXIJOHTcCQQCZw5127ZGs8ZDTSrogrH73Kw/HvX55wGAeirKYcv28eauveCG7iyFR0PFB/P/EDZnyb+ifvyEFlucPUI0+Y87F'

const ChapterImageProtoDefinition = `
  // https://github.com/tachiyomiorg/tachiyomi-extensions/blob/master/src/zh/dmzj/API.md

  syntax = "proto3";

  package dmzj.chapter_images;

  message ResponseDto {
    int32 Errno = 1;
    string Errmsg = 2;
    ChapterImagesDto Data= 3;
  }

  message ChapterImagesDto {
    int32 Id = 1;
    int32 MangaId = 2;
    string Name= 3;
    int32 Order= 4;
    int32 Direction= 5;
    repeated string LowResImages= 6;
    int32 PageCount= 7;
    repeated string Images= 8;
    int32 CommentCount= 9;
  }
`

const ChapterListProtoDefinition = `
  syntax = "proto3";

  package dmzj.comic;


  message ComicDetailResponse {
    int32 Errno = 1;
    string Errmsg = 2;
    ComicDetailInfoResponse Data= 3;
  }

  message ComicDetailInfoResponse {
    int32 Id = 1;
    string Title = 2;
    int32 Direction=3;
    int32 Islong=4;
    int32 IsDmzj=5;
    string Cover=6;
    string Description=7;
    int64 LastUpdatetime=8;
    string LastUpdateChapterName=9;
    int32 Copyright=10;
    string FirstLetter=11;
    string ComicPy=12;
    int32 Hidden=13;
    int32 HotNum=14;
    int32 HitNum=15;
    int32 Uid=16;
    int32 IsLock=17;
    int32 LastUpdateChapterId=18;
    repeated ComicDetailTypeItemResponse Types=19;
    repeated ComicDetailTypeItemResponse Status=20;
    repeated ComicDetailTypeItemResponse Authors=21;
    int32 SubscribeNum=22;
    repeated ComicDetailChapterResponse Chapters=23;
    int32 IsNeedLogin=24;
    //object UrlLinks=25;
    int32 IsHideChapter=26;
    //object DhUrlLinks=27;
  }

  message ComicDetailTypeItemResponse {
    int32 TagId = 1;
    string TagName = 2;
  }

  message ComicDetailChapterResponse {
    string Title = 1;
    repeated ComicDetailChapterInfoResponse Data=2;
  }
  message ComicDetailChapterInfoResponse {
    int32 ChapterId = 1;
    string ChapterTitle = 2;
    int64 Updatetime=3;
    int32 Filesize=4;
    int32 ChapterOrder=5;
  }
`

// 需要注意buffer的长度 不要有为空为0的 否则 protobuf 解码会失败
export function ApiV4Decrypt(data: string): Buffer {
  const keyByte = Buffer.from(key, 'base64')
  const privateKey = crypto.createPrivateKey({
    key: keyByte,
    format: 'der',
    type: 'pkcs8'
  })
  const tempData = Buffer.from(data, 'base64')
  const MAX_DECRYPT_BLOCK = 128
  const inputLen = tempData.length
  let result = new Uint8Array(inputLen)
  let chunk = 0
  // 该循环是为了分段解码 每128位解码一次
  for (let offset = 0; offset < inputLen; offset += MAX_DECRYPT_BLOCK) {
    // min 是为了结尾时不多取buffer位数
    const blockLen = Math.min(MAX_DECRYPT_BLOCK, inputLen - offset)
    const encryptedData = tempData.subarray(offset, offset + blockLen)
    // console.log(encryptedData.length)
    const decryptData = crypto.privateDecrypt({
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
    }, encryptedData)
    // 注意这里不能使用 offset 而需使用计算的chunk，
    // 因为 128位进行解码后不一定是 128 是不定长度的
    // 所以手动计算chunk位数
    result.set(decryptData, chunk)
    chunk = chunk + decryptData.length
  }
  result = result.subarray(0, chunk)
  return Buffer.from(result)
}

interface ApiV4ChapterImageData {
  Id: number,
  MangaId: number,
  Name: string,
  Order: number,
  Direction: number,
  LowResImages: string[]
  PageCount: number,
  Images: string[],
  CommentCount: number
}

export function ApiV4ChapterImageParse(data: Buffer): ApiV4ChapterImageData | null{
  const root = protobuf.parse(ChapterImageProtoDefinition, {
    keepCase: true
  }).root

  const ResponseDto = root.lookupType('ResponseDto')
  const decodedRes = ResponseDto.decode(data)
  const decodedObject = ResponseDto.toObject(decodedRes, {
    longs: String,
    enums: String,
    bytes: String
  })
  if (!decodedObject) {
    return null
  }
  return decodedObject?.Data as ApiV4ChapterImageData
}

interface ApiV4ChapterItem {
  ChapterId: number,
  ChapterOrder: number,
  ChapterTitle: string,
  Filesize: number
}

interface ApiV4ChapterList {
  Chapters: {
    Title: string
    Data: ApiV4ChapterItem[]
  }[]
  [key: string]: any
}
export function ApiV4ChapterListParse(data: Buffer): ApiV4ChapterList | null{
  const root = protobuf.parse(ChapterListProtoDefinition, {
    keepCase: true
  }).root

  const ResponseDto = root.lookupType('ComicDetailResponse')
  const decodedRes = ResponseDto.decode(data)
  const decodedObject = ResponseDto.toObject(decodedRes, {
    longs: String,
    enums: String,
    bytes: String
  })
  if (!decodedObject) {
    return null
  }
  return decodedObject?.Data as ApiV4ChapterList
}