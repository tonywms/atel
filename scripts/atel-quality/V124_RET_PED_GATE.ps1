param(
  [string]$ProjectRoot = 'C:\wms-atel',
  [string]$ReportPath = ''
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$file = Join-Path $ProjectRoot 'app\coletor\retornos\ped\[codigo]\page.tsx'
if (!(Test-Path -LiteralPath $file)) { throw 'Tela RET-PED nao encontrada.' }
$content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
$checks = @(
  @{ Name='RPC de consulta remota'; Pattern='atel_v3730_listar_rets' },
  @{ Name='RPC de transicao'; Pattern='atel_v3730_transicionar_ret' },
  @{ Name='Estado aguardando retorno'; Pattern='AGUARDANDO_RETORNO' },
  @{ Name='Estado em transito'; Pattern='EM_TRANSITO_CD' },
  @{ Name='Estado aguardando conferencia'; Pattern='AGUARDANDO_CONFERENCIA' },
  @{ Name='Estado finalizado'; Pattern='FINALIZADO' },
  @{ Name='Protecao operacao em andamento'; Pattern='\boperando\b' },
  @{ Name='Consulta posterior ao envio'; Pattern='erroConfirmacao' },
  @{ Name='Modal acessivel'; Pattern='aria-modal="true"' },
  @{ Name='Retorno para expedicoes'; Pattern='/coletor/expedicoes' },
  @{ Name='Confirmacao fisica'; Pattern='confirmacaoAberta' },
  @{ Name='Mensagem de erro'; Pattern='setErro\(' }
)
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('ATEL E1 V124 - GATE DE QUALIDADE RET-PED')
$lines.Add('Data: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
$lines.Add('Arquivo: ' + $file)
$failed = 0
foreach ($check in $checks) {
  $ok = [regex]::IsMatch($content, [string]$check.Pattern)
  if (-not $ok) { $failed++ }
  $state = if ($ok) { 'OK' } else { 'FALHA' }
  $line = ('[{0}] {1}' -f $state, $check.Name)
  $lines.Add($line)
  Write-Host $line
}
$lines.Add(('Resultado: {0}/{1} verificacoes aprovadas' -f ($checks.Count-$failed), $checks.Count))
if ($ReportPath) {
  $folder = Split-Path -Parent $ReportPath
  if (!(Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
  [System.IO.File]::WriteAllLines($ReportPath, $lines.ToArray(), (New-Object System.Text.UTF8Encoding($false)))
}
if ($failed -gt 0) { throw ('Gate V124 reprovado: ' + $failed + ' verificacoes falharam.') }
Write-Host 'Gate V124 aprovado.' -ForegroundColor Green
