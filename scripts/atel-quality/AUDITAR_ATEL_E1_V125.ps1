param([string]$Projeto = 'C:\wms-atel', [string]$Relatorio = '')
$ErrorActionPreference = 'Stop'
$arquivo = Join-Path $Projeto 'app\coletor\retornos\ped\[codigo]\page.tsx'
if (-not (Test-Path -LiteralPath $arquivo)) { throw "Arquivo RET-PED nao encontrado: $arquivo" }
$texto = [System.IO.File]::ReadAllText($arquivo, [System.Text.Encoding]::UTF8)
$checks = @(
  @{ Nome='RPC de consulta remota'; Padrao='atel_v3730_listar_rets' },
  @{ Nome='RPC de transicao'; Padrao='atel_v3730_transicionar_ret' },
  @{ Nome='Estado pendente'; Padrao='AGUARDANDO_RETORNO' },
  @{ Nome='Estado em transito'; Padrao='EM_TRANSITO_CD' },
  @{ Nome='Estado conferencia'; Padrao='AGUARDANDO_CONFERENCIA' },
  @{ Nome='Estado finalizado'; Padrao='FINALIZADO' },
  @{ Nome='Verificacao de status remoto'; Padrao='atual.status' },
  @{ Nome='Confirmacao posterior ao envio'; Padrao='erroConfirmacao' },
  @{ Nome='Protecao de operacao simultanea'; Padrao='operando' },
  @{ Nome='Modal de confirmacao'; Padrao='role="dialog"' },
  @{ Nome='Retorno as expedicoes'; Padrao='/coletor/expedicoes' },
  @{ Nome='Tratamento de erro'; Padrao='setErro' }
)
$linhas = New-Object 'System.Collections.Generic.List[string]'
$linhas.Add('ATEL E1 V125 - DIAGNOSTICO ESTATICO RET-PED')
$linhas.Add('Data: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
$linhas.Add('Arquivo: ' + $arquivo)
$linhas.Add('SHA256: ' + (Get-FileHash -LiteralPath $arquivo -Algorithm SHA256).Hash)
$falhas = 0
foreach ($c in $checks) {
  $ok = $texto.Contains([string]$c.Padrao)
  if (-not $ok) { $falhas++ }
  $estado = if ($ok) { 'OK' } else { 'FALHA' }
  $linhas.Add("[$estado] $($c.Nome)")
  Write-Host "[$estado] $($c.Nome)"
}
$linhas.Add("Resultado: $($checks.Count - $falhas)/$($checks.Count) verificacoes")
$linhas.Add('Nota: analise estatica; nao comprova comportamento de rede, banco ou interface.')
if ($Relatorio) {
  $pasta = Split-Path -Parent $Relatorio
  if (-not (Test-Path -LiteralPath $pasta)) { New-Item -ItemType Directory -Path $pasta -Force | Out-Null }
  [System.IO.File]::WriteAllLines($Relatorio, $linhas, (New-Object System.Text.UTF8Encoding($false)))
}
if ($falhas -gt 0) { throw "Diagnostico V125 encontrou $falhas verificacao(oes) ausente(s)." }
Write-Host 'AUDITORIA V125 OK' -ForegroundColor Green
