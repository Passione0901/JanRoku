# Updated 2026-09-12: Outline the glyph so the tab icon does not depend on device fonts.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$outDir = Join-Path $PSScriptRoot '../public'
[System.IO.Directory]::CreateDirectory($outDir) | Out-Null
$glyph = [System.Drawing.Drawing2D.GraphicsPath]::new()
$family = [System.Drawing.FontFamily]::new('Yu Gothic UI')
$glyph.AddString('雀', $family, [int][System.Drawing.FontStyle]::Bold, 52, [System.Drawing.PointF]::new(0, 0), [System.Drawing.StringFormat]::GenericTypographic)
$bounds = $glyph.GetBounds()
$scale = [Math]::Min(40 / $bounds.Width, 42 / $bounds.Height)
$matrix = [System.Drawing.Drawing2D.Matrix]::new($scale, 0, 0, $scale, 32 - ($bounds.X + $bounds.Width / 2) * $scale, 30 - ($bounds.Y + $bounds.Height / 2) * $scale)
$glyph.Transform($matrix)
$culture = [System.Globalization.CultureInfo]::InvariantCulture
function PointText($point) { $point.X.ToString('0.###', $culture) + ',' + $point.Y.ToString('0.###', $culture) }
$segments = [System.Collections.Generic.List[string]]::new()
$points = $glyph.PathPoints
$types = $glyph.PathTypes
for ($i = 0; $i -lt $points.Length; $i++) {
  switch ($types[$i] -band 7) {
    0 { $segments.Add('M' + (PointText $points[$i])) }
    1 { $segments.Add('L' + (PointText $points[$i])) }
    3 { $segments.Add('C' + (PointText $points[$i]) + ' ' + (PointText $points[$i+1]) + ' ' + (PointText $points[$i+2])); $i += 2 }
  }
  if ($types[$i] -band 128) { $segments.Add('Z') }
}
$pathData = $segments -join ''
$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="5" y="4" width="54" height="59" rx="8" fill="#214c43"/><rect x="5" y="1" width="54" height="57" rx="8" fill="#fffdf5" stroke="#bbb7a9" stroke-width="1.5"/><path fill="#202723" d="' + $pathData + '"/></svg>'
[System.IO.File]::WriteAllText((Join-Path $outDir 'favicon-sparrow.svg'), $svg, [System.Text.UTF8Encoding]::new($false))
function RoundedRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = 2 * $r
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x+$w-$d, $y, $d, $d, 270, 90)
  $p.AddArc($x+$w-$d, $y+$h-$d, $d, $d, 0, 90)
  $p.AddArc($x, $y+$h-$d, $d, $d, 90, 90)
  $p.CloseFigure()
  return ,$p
}
$back = RoundedRect 5 4 54 59 8
$face = RoundedRect 5 1 54 57 8
$backBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#214c43'))
$faceBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#fffdf5'))
$ink = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#202723'))
$pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#bbb7a9'), 1.5)
$icons = @()
foreach ($size in @(16, 32, 48, 180, 256)) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.ScaleTransform($size / 64.0, $size / 64.0)
  $graphics.FillPath($backBrush, $back)
  $graphics.FillPath($faceBrush, $face)
  $graphics.DrawPath($pen, $face)
  $graphics.FillPath($ink, $glyph)
  $stream = [System.IO.MemoryStream]::new()
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $stream.ToArray()
  if ($size -eq 180) { [System.IO.File]::WriteAllBytes((Join-Path $outDir 'apple-touch-icon.png'), $bytes) }
  else { $icons += @{ Size = $size; Bytes = $bytes } }
  if ($size -eq 32) { [System.IO.File]::WriteAllBytes((Join-Path $outDir 'favicon-32.png'), $bytes) }
  $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
$ico = [System.IO.MemoryStream]::new()
$writer = [System.IO.BinaryWriter]::new($ico)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$icons.Count)
$offset = 6 + 16 * $icons.Count
foreach ($icon in $icons) {
  $dimension = if ($icon.Size -eq 256) { 0 } else { $icon.Size }
  $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
  $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([uint16]1); $writer.Write([uint16]32)
  $writer.Write([uint32]$icon.Bytes.Length); $writer.Write([uint32]$offset)
  $offset += $icon.Bytes.Length
}
foreach ($icon in $icons) { $writer.Write([byte[]]$icon.Bytes) }
[System.IO.File]::WriteAllBytes((Join-Path $outDir 'favicon-sparrow.ico'), $ico.ToArray())
$writer.Dispose(); $ico.Dispose()
$glyph.Dispose(); $family.Dispose(); $matrix.Dispose(); $back.Dispose(); $face.Dispose()
$backBrush.Dispose(); $faceBrush.Dispose(); $ink.Dispose(); $pen.Dispose()
