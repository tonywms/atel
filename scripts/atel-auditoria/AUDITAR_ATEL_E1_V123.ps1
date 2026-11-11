param([string]$Projeto = 'C:\wms-atel')
$ErrorActionPreference = 'Stop'
$arquivo = Join-Path $Projeto 'app\coletor\retornos\ped\[codigo]\page.tsx'
if (-not (Test-Path -LiteralPath $arquivo)) { throw 'V123: pagina RET-PED nao encontrada.' }
$fonte = [System.IO.File]::ReadAllText($arquivo, [System.Text.Encoding]::UTF8)
$checks = [ordered]@{
  'RPC consulta de RET' = 'atel_v3730_listar_rets'
  'RPC transicao de RET' = 'atel_v3730_transicionar_ret'
  'Estado aguardando retorno' = 'AGUARDANDO_RETORNO'
  'Estado em transito' = 'EM_TRANSITO_CD'
  'Estado aguardando conferencia' = 'AGUARDANDO_CONFERENCIA'
  'Estado finalizado' = 'FINALIZADO'
  'Consulta apos comando' = 'erroConfirmacao'
  'Protecao de operacao concorrente' = 'operando'
  'Modal de sucesso' = 'aria-modal="true"'
  'Voltar a expedicoes' = '/coletor/expedicoes'
  'Tratamento de erro' = 'catch (e)'
  'Confirmacao fisica' = 'confirmarEnvio'
}
$falhas = @()
foreach ($item in $checks.GetEnumerator()) {
  if ($fonte.Contains($item.Value)) { Write-Host ('[OK] ' + $item.Key) -ForegroundColor Green }
  else { Write-Host ('[FALHA] ' + $item.Key) -ForegroundColor Red; $falhas += $item.Key }
}
if ($falhas.Count -gt 0) { throw ('V123: verificacoes estaticas falharam: ' + ($falhas -join ', ')) }
Write-Host ('V123: ' + $checks.Count + ' verificacoes estaticas aprovadas.') -ForegroundColor Green
