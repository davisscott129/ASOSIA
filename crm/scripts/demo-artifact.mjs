// Convierte dist-demo/index.html en una página publicable (sin doctype/html/head/body).
import fs from 'fs'
const html = fs.readFileSync('dist-demo/index.html', 'utf8')
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1]
const title = head.match(/<title>.*?<\/title>/)[0]
const links = (head.match(/<link[^>]+>/g) || []).filter((l) => /fonts\.g|icon/.test(l)).join('\n')
const resto = head.replace(/<meta[^>]*>|<title>.*?<\/title>|<link[^>]+>/g, '').trim()
fs.mkdirSync('dist-demo', { recursive: true })
fs.writeFileSync('dist-demo/asosia-crm-demo.html', `${title}\n${links}\n<style>:root{color-scheme:light}html,body{background:#eef3f4}</style>\n${resto}\n${body}`)
console.log('ok', fs.statSync('dist-demo/asosia-crm-demo.html').size)
