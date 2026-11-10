param([switch]$Strict)
$ErrorActionPreference='Stop'
$project='C:\wms-atel'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$baseline=Get-Content -LiteralPath (Join-Path $root 'BASELINE_V83.json') -Raw | ConvertFrom-Json
$errors=New-Object 'System.Collections.Generic.List[string]'
$warnings=New-Object 'System.Collections.Generic.List[string]'
$lines=New-Object 'System.Collections.Generic.List[string]'
$lines.Add('ATEL V83 - AUDITORIA DESIGN SYSTEM')
$lines.Add('Data: '+(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
$lines.Add('Projeto: '+$project)
foreach($entry in $baseline.PSObject.Properties){
 $rel=$entry.Name; $p=Join-Path $project ($rel.Replace('/','\'))
 if(!(Test-Path -LiteralPath $p -PathType Leaf)){ $errors.Add('AUSENTE: '+$rel);continue }
 $hash=(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()
 if($hash -ne $entry.Value){$warnings.Add('ALTERADO DESDE V81/V82: '+$rel)}
}
$required=@('components\atel-ui\index.tsx','components\atel-ui\atel-tokens.module.css','app\admin\homologacao-cadastros-v74\DepositosV80.tsx','app\admin\homologacao-cadastros-v74\atel-v80.module.css')
foreach($rel in $required){if(!(Test-Path -LiteralPath (Join-Path $project $rel) -PathType Leaf)){$errors.Add('DEPENDENCIA AUSENTE: '+$rel)}}
$pages=@('app\clientes\page.tsx','app\ativos\page.tsx','app\tecnicos\page.tsx')
foreach($rel in $pages){
 $p=Join-Path $project $rel
 if(Test-Path -LiteralPath $p){
  $txt=Get-Content -LiteralPath $p -Raw
  if($txt -notmatch 'AtelCadastro'){$errors.Add('SEM COMPONENTES V82: '+$rel)}
  if($txt -notmatch 'useDemo'){$warnings.Add('HOOK DEMONSTRATIVO NAO IDENTIFICADO: '+$rel)}
 }
}
$legacy=@('app\admin\homologacao-cadastros-v74\atel-v77.module.css','app\admin\homologacao-cadastros-v74\atel-v78.module.css','app\admin\homologacao-cadastros-v74\atel-v79.module.css','app\cadastros\atel-v77.module.css','app\cadastros\atel-v79-cadastros.module.css')
foreach($rel in $legacy){
 $p=Join-Path $project $rel
 if(Test-Path -LiteralPath $p){
  $warnings.Add('CSS LEGADO PRESENTE (NAO REMOVER SEM AUDITORIA DE IMPORTS): '+$rel)
 }
}
$cssfiles=@(Get-ChildItem -LiteralPath (Join-Path $project 'components\atel-ui') -Filter '*.css' -File -ErrorAction SilentlyContinue)
$vars=@{}
foreach($f in $cssfiles){
 $content=Get-Content -LiteralPath $f.FullName -Raw
 foreach($m in [regex]::Matches($content,'--atel-[a-zA-Z0-9-]+\s*:')){
  $name=$m.Value.TrimEnd(':').Trim()
  if(!$vars.ContainsKey($name)){$vars[$name]=@()}
  $vars[$name]+=$f.Name
 }
}
foreach($name in $vars.Keys){if(@($vars[$name] | Select-Object -Unique).Count -gt 1){$warnings.Add('TOKEN DECLARADO EM MAIS DE UM ARQUIVO: '+$name)}}
$lines.Add('')
$lines.Add('ERROS: '+$errors.Count)
foreach($e in $errors){$lines.Add('[ERRO] '+$e)}
$lines.Add('')
$lines.Add('OBSERVACOES: '+$warnings.Count)
foreach($w in $warnings){$lines.Add('[AVISO] '+$w)}
$lines.Add('')
$lines.Add('NOTA: auditoria estatica; nao substitui testes de navegacao e de funcionalidade.')
$report=Join-Path $root 'RELATORIO_ATEL_V83.txt'
[System.IO.File]::WriteAllLines($report,[string[]]$lines,[System.Text.UTF8Encoding]::new($false))
$lines | ForEach-Object { Write-Host $_ }
Write-Host ('Relatorio: '+$report) -ForegroundColor Cyan
if($errors.Count -gt 0){exit 2}
if($Strict -and $warnings.Count -gt 0){exit 3}
exit 0
