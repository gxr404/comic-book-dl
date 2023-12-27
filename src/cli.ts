import { readFileSync } from 'fs'
import { cac } from 'cac'
import { main } from './index'
import logger from './log'

const cli = cac('comic-dl')

export interface IOptions {
  bookPath: string;
}

// 不能直接使用 import {version} from '../package.json'
// 否则declaration 生成的d.ts 会多一层src目录
const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url)).toString(),
)


cli
  .command('<url>', '包子漫画-漫画目录页url')
  .option('-d, --dist <dir>', '下载的目录 eg: -d comic-dist', {
    default: 'comic-dist',
  })
  .action(async (url, options: IOptions) => {
    try {
      await main({
        targetUrl: url,
        bookPath: options.bookPath
      })
    } catch (err) {
      console.log(err)
      logger.error(err.message || 'unknown exception')
    }
  })

cli.help()
cli.version(version)

try {
  cli.parse()
} catch (err) {
  logger.error(err.message || 'unknown exception')
  process.exit(1)
}
