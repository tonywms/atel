param(
 [string]$Projeto='C:\wms-atel',
 [string]$WmsCsv='',
 [string]$AdapterCsv=''
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$base=Split-Path -Parent $MyInvocation.MyCommand.Path
if(-not (Test-Path -LiteralPath (Join-Path $Projeto 'package.json') -PathType Leaf)){throw "Projeto nao encontrado: $Projeto"}
if([string]::IsNullOrWhiteSpace($WmsCsv)){throw 'Informe -WmsCsv com a exportacao COMPLETA da tabela produto do PostgreSQL WMS.'}
if(-not (Test-Path -LiteralPath $WmsCsv -PathType Leaf)){throw "CSV WMS nao encontrado: $WmsCsv"}
$refPath=Join-Path $base 'CATALOGO_ERP_SNAPSHOT_7.csv'
$origem='SNAPSHOT_SUPABASE_7_PRODUTOS_NAO_ATUALIZADO_EM_TEMPO_REAL'
if(-not [string]::IsNullOrWhiteSpace($AdapterCsv)){
 if(-not (Test-Path -LiteralPath $AdapterCsv -PathType Leaf)){throw "CSV Adapter nao encontrado: $AdapterCsv"}
 $refPath=$AdapterCsv
 $origem='CSV_ADAPTER_FORNECIDO_NAO_VERIFICADO_AUTOMATICAMENTE'
}
$ref=@(Import-Csv -LiteralPath $refPath -Delimiter ';' -Encoding UTF8)
$firstLine=[System.IO.File]::ReadLines($WmsCsv) | Select-Object -First 1
if($firstLine.StartsWith([char]0xFEFF)){$firstLine=$firstLine.TrimStart([char]0xFEFF)}
$delimiter=';'
if(($firstLine.ToCharArray() | Where-Object {$_ -eq ','} | Measure-Object).Count -gt ($firstLine.ToCharArray() | Where-Object {$_ -eq ';'} | Measure-Object).Count){$delimiter=','}
$wms=@(Import-Csv -LiteralPath $WmsCsv -Delimiter $delimiter -Encoding UTF8)
Write-Host "Separador WMS detectado: $delimiter"
if($ref.Count -eq 0){throw 'Referencia vazia'}
if($wms.Count -eq 0){throw 'Exportacao WMS vazia: interrompido para evitar falso diagnostico'}
foreach($dataset in @(@{nome='referencia';rows=$ref;cols=@('idempresa','codigoproduto','nome','unidadepadrao')},@{nome='WMS';rows=$wms;cols=@('idempresa','idproduto','codigoproduto','nome','unidadepadrao')})){
 foreach($col in $dataset.cols){if(-not ($dataset.rows[0].PSObject.Properties.Name -contains $col)){throw "Coluna ausente em $($dataset.nome): $col"}}
}
$map=@{}; $dupWms=@{}; $seenId=@{}; $semCodigo=0
foreach($p in $wms){
 $emp=([string]$p.idempresa).Trim();$code=([string]$p.codigoproduto).Trim();$id=([string]$p.idproduto).Trim()
 if(-not $emp -or -not $id){throw 'WMS possui registro sem empresa ou idproduto: revisar exportacao'}
 if(-not $code){$semCodigo++;continue}
 $k="$emp|$code"
 if(-not $map.ContainsKey($k)){$map[$k]=New-Object 'System.Collections.Generic.List[object]'}
 $map[$k].Add($p)
 $idkey="$emp|$id";if($seenId.ContainsKey($idkey)){throw "idproduto duplicado no WMS exportado: $idkey"};$seenId[$idkey]=$true
}
foreach($k in $map.Keys){if($map[$k].Count -gt 1){$dupWms[$k]=$map[$k].Count}}
$seenRef=@{};$result=New-Object 'System.Collections.Generic.List[object]'
foreach($p in $ref){
 $emp=([string]$p.idempresa).Trim();$code=([string]$p.codigoproduto).Trim();$name=([string]$p.nome).Trim()
 if(-not $emp -or -not $code -or -not $name){throw 'Referencia contem registro sem empresa, codigo ou nome'}
 $k="$emp|$code";if($seenRef.ContainsKey($k)){throw "Codigo duplicado na referencia: $k"};$seenRef[$k]=$true
 $id='';$oldName='';$oldUnit='';$status='INSERIR_CANDIDATO';$obs='Confirmar origem oficial e integridade do CSV WMS'
 if($map.ContainsKey($k)){
  if($map[$k].Count -gt 1){$status='BLOQUEAR_DUPLICIDADE_WMS';$obs='Mais de um produto para empresa+codigo'}
  else{
   $m=$map[$k][0];$id=$m.idproduto;$oldName=$m.nome;$oldUnit=$m.unidadepadrao
   if(([string]$m.nome) -cne ([string]$p.nome) -or ([string]$m.unidadepadrao) -cne ([string]$p.unidadepadrao)){$status='ATUALIZAR_CANDIDATO';$obs='Diferenca em nome e/ou unidade'}
   else{$status='MANTER';$obs='Campos comparados coincidem'}
  }
 }
 $result.Add([pscustomobject]@{idempresa=$emp;codigoproduto=$code;idproduto_wms=$id;nome_wms=$oldName;nome_referencia=$p.nome;unidade_wms=$oldUnit;unidade_referencia=$p.unidadepadrao;resultado=$status;observacao=$obs})
}
$stamp=Get-Date -Format 'yyyyMMdd_HHmmss'
$out=Join-Path (Join-Path $Projeto 'BACKUPS_ATEL_V68') $stamp
New-Item -ItemType Directory -Path $out -Force | Out-Null
$report=Join-Path $out 'COMPARACAO_V68.csv'
$result | Export-Csv -LiteralPath $report -Delimiter ';' -NoTypeInformation -Encoding UTF8
$summary=Join-Path $out 'RESUMO_V68.txt'
$lines=New-Object 'System.Collections.Generic.List[string]'
$lines.Add('ATEL V68 - ANALISE SOMENTE LEITURA')
$lines.Add("Origem da referencia: $origem")
$lines.Add("Referencia: $refPath")
$lines.Add("Exportacao WMS: $WmsCsv")
$lines.Add("Linhas WMS: $($wms.Count); linhas referencia: $($ref.Count)")
$lines.Add("Duplicidades empresa+codigo no WMS completo: $($dupWms.Count)")
$lines.Add("Produtos sem codigoproduto, ignorados na correspondencia: $semCodigo")
foreach($g in @($result | Group-Object resultado)){$lines.Add("$($g.Name): $($g.Count)")}
$lines.Add('ALERTA: CSV WMS completo e atualizado deve ser confirmado pelo operador.')
$lines.Add('ALERTA: snapshot Supabase nao comprova resposta atual do Adapter.')
$lines.Add('Nenhum SQL, INSERT, UPDATE, DELETE, Git ou deploy executado.')
[System.IO.File]::WriteAllLines($summary,$lines,(New-Object System.Text.UTF8Encoding($false)))
Write-Host 'V68 concluida - nenhuma gravacao no banco' -ForegroundColor Green
Write-Host "Comparacao: $report"
Write-Host "Resumo: $summary"
$result | Format-Table idempresa,codigoproduto,idproduto_wms,resultado -AutoSize
