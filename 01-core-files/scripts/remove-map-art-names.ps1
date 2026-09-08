Add-Type -AssemblyName System.Drawing

function Copy-Patch {
  param($Graphics, [int]$TargetX, [int]$TargetY, [int]$Width, [int]$Height, [int]$SourceX, [int]$SourceY, $Bitmap)
  $destination = [System.Drawing.Rectangle]::new($TargetX, $TargetY, $Width, $Height)
  $source = [System.Drawing.Rectangle]::new($SourceX, $SourceY, $Width, $Height)
  $Graphics.DrawImage($Bitmap, $destination, $source, [System.Drawing.GraphicsUnit]::Pixel)
}

function Remove-Names {
  param([string]$InputPath, [string]$OutputPath, [array]$CentralLabels, [array]$OuterLabels)
  $source = [System.Drawing.Bitmap]::new($InputPath)
  $edited = [System.Drawing.Bitmap]::new($source.Width, $source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($edited)
  $graphics.DrawImageUnscaled($source, 0, 0)

  foreach ($label in $CentralLabels) {
    $sample = if ($label.ContainsKey('R')) {[System.Drawing.Color]::FromArgb($label.R, $label.G, $label.B)} else {$source.GetPixel($label.SX, $label.SY)}
    $brush = [System.Drawing.SolidBrush]::new($sample)
    $graphics.FillRectangle($brush, $label.X, $label.Y, $label.W, $label.H)
    $brush.Dispose()
  }

  $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  foreach ($label in $OuterLabels) {
    $graphics.FillRectangle($white, $label.X, $label.Y, $label.W, $label.H)
  }

  $white.Dispose()
  $graphics.Dispose()
  $source.Dispose()
  $edited.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $edited.Dispose()
}

$publicDir = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $publicDir 'source-assets\legacy-public'
$publicDir = Join-Path $publicDir 'public'

Remove-Names `
  (Join-Path $sourceDir 'jiangong-art-map-clean.png') `
  (Join-Path $publicDir 'jiangong-art-map-no-names.png') `
  @(
    @{X=461;Y=199;W=80;H=20;R=200;G=203;B=126},
    @{X=565;Y=184;W=82;H=20;R=194;G=196;B=123},
    @{X=654;Y=169;W=64;H=21;R=210;G=214;B=158},
    @{X=766;Y=368;W=96;H=22;R=198;G=200;B=116}
  ) `
  @(
    @{X=43;Y=201;W=137;H=48},
    @{X=77;Y=350;W=125;H=48},
    @{X=29;Y=554;W=143;H=48},
    @{X=77;Y=680;W=94;H=48}
  )

$yanchao = [System.Drawing.Bitmap]::new((Join-Path $sourceDir 'yanchao-art-map.png'))
$yw = $yanchao.Width
$yh = $yanchao.Height
$yanchao.Dispose()
$central = @(
  @{X=[int]($yw*.396+24);Y=[int]($yh*.392-24);W=170;H=42;SX=[int]($yw*.396+210);SY=[int]($yh*.392-24)},
  @{X=[int]($yw*.522+24);Y=[int]($yh*.121-24);W=170;H=42;SX=[int]($yw*.522+210);SY=[int]($yh*.121-24)},
  @{X=[int]($yw*.541+24);Y=[int]($yh*.186-24);W=170;H=42;SX=[int]($yw*.541+210);SY=[int]($yh*.186-24)},
  @{X=[int]($yw*.367+24);Y=[int]($yh*.682-24);W=170;H=42;SX=[int]($yw*.367+210);SY=[int]($yh*.682-24)},
  @{X=[int]($yw*.412+24);Y=[int]($yh*.642-24);W=170;H=42;SX=[int]($yw*.412+210);SY=[int]($yh*.642-24)},
  @{X=[int]($yw*.533+24);Y=[int]($yh*.564-24);W=170;H=42;SX=[int]($yw*.533+210);SY=[int]($yh*.564-24)},
  @{X=[int]($yw*.702+24);Y=[int]($yh*.526-24);W=170;H=42;SX=[int]($yw*.702+210);SY=[int]($yh*.526-24)},
  @{X=[int]($yw*.762+24);Y=[int]($yh*.371-24);W=170;H=42;SX=[int]($yw*.762+210);SY=[int]($yh*.371-24)}
)
$outerPoints = @(@(.355,.045),@(.705,.045),@(.88,.07),@(.086,.876),@(.332,.878),@(.582,.772),@(.752,.742),@(.924,.652))
$outer = foreach ($point in $outerPoints) {@{X=[int]($yw*$point[0]-108);Y=[int]($yh*$point[1]-28);W=285;H=94}}
Remove-Names (Join-Path $sourceDir 'yanchao-art-map.png') (Join-Path $publicDir 'yanchao-art-map-no-names.png') $central $outer
