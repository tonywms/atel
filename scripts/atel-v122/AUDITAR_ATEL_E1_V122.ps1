param([string]$Projeto = 'C:\wms-atel')
$ErrorActionPreference = 'Stop'
$arquivo = Join-Path $Projeto 'app\coletor\retornos\ped\[codigo]\page.tsx'
if (-not [System.IO.File]::Exists($arquivo)) { throw 'Arquivo RET-PED nao encontrado.' }
$fonte = [System.IO.File]::ReadAllText($arquivo, [System.Text.Encoding]::UTF8)
$regras = [ordered]@{
  'Consulta remota' = 'atel_v3730_listar_rets'
  'Transicao remota' = 'atel_v3730_transicionar_ret'
  'Estado pendente' = 'AGUARDANDO_RETORNO'
  'Estado em transito' = 'EM_TRANSITO_CD'
  'Estado conferencia' = 'AGUARDANDO_CONFERENCIA'
  'Estado finalizado' = 'FINALIZADO'
  'Confirmacao apos comando' = 'erroConfirmacao'
  'Prevencao de duplicidade' = 'atual.status'
  'Retorno a expedicoes' = '/coletor/expedicoes'
  'Modal de sucesso' = 'aria-modal'
}
$falhas = @()
foreach ($regra in $regras.GetEnumerator()) {
  $ok = $fonte.Contains($regra.Value)
  if ($ok) { Write-Host ('OK  ' + $regra.Key) -ForegroundColor Green }
  else { Write-Host ('FALHA  ' + $regra.Key) -ForegroundColor Red; $falhas += $regra.Key }
}
if ($falhas.Count -gt 0) { throw ('Auditoria falhou: ' + ($falhas -join ', ')) }
Write-Host 'AUDITORIA V122 APROVADA - verificacoes estaticas.' -ForegroundColor Green
