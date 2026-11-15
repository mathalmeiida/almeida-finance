import fs from 'fs'

const app = fs.readFileSync('src/App.jsx', 'utf-8')
const rotas = [
  '/apresentacao-inicial',
  '/onboarding-novo', 
  '/login',
  '/cadastro',
  '/registrar',
  '/calendario',
  '/receitas',
  '/despesas',
  '/cartoes',
  '/investimentos',
  '/consultoria',
  '/mais'
]

let erros = 0
rotas.forEach(rota => {
  if (!app.includes(rota)) {
    console.log(`FALHA - Rota ${rota} nao encontrada`)
    erros++
  } else {
    console.log(`PASS - Rota ${rota} OK`)
  }
})

console.log(`\nTotal: ${rotas.length - erros}/${rotas.length} rotas OK`)
if (erros > 0) process.exitCode = 1
