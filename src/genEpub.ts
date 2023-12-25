import { writeFile, readFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import _epub from 'epub-gen-memory'
import { fileURLToPath } from "url"
import type { BookInfo } from './index'

const epub = ((_epub as any).default) as typeof _epub

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)


interface GenEpubParam {
  sourcePath: string
}

export async function genEpub({sourcePath}: GenEpubParam) {
  const bookInfoStr = await readFile(`${sourcePath}/bookInfo.json`, {encoding: 'utf-8'})
  const bookInfo: BookInfo = JSON.parse(bookInfoStr)

// title?: string;
//   author?: string | string[];
//   content: string;
//   excludeFromToc?: boolean;
//   beforeToc?: boolean;
//   filename?: string;
//   url?: string;

  const chapterList = bookInfo.chapters.map((item) => {
    const content =item.imageListPath.reduce((pre, val) => {
      return `${pre}<img src="file://${val}"></img>`
    }, '')
    return {
      title: item.name,
      content
    }
  })
  const content = await epub({
      title: bookInfo.name,
      cover: `${sourcePath}/${bookInfo.coverPath}`,
      author: bookInfo.author,
      css: "img{display:block}"
    }, chapterList)
    await writeFile(`${sourcePath}/${bookInfo.name}.epub`, Buffer.from(content))
}

genEpub({
  sourcePath: resolve(__dirname, '../manga-book-dist/川科插画集')
})