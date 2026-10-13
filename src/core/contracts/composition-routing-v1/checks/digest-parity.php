<?php
// Cross-language probe: recomputes simai.recipe.canonical-json.v1 bytes and
// Document digests for every valid capability fixture. It is not a validator,
// resolver or renderer; those remain owner-runtime checks.
declare(strict_types=1);

function canonical(mixed $v): string {
    if ($v instanceof stdClass) {
        $items = get_object_vars($v);
        uksort($items, function ($a, $b) {
            $a = (string) $a; $b = (string) $b;
            $ai = preg_match('/^(0|[1-9][0-9]*)$/D', $a) && strlen($a) <= 10 && (float) $a <= 4294967294;
            $bi = preg_match('/^(0|[1-9][0-9]*)$/D', $b) && strlen($b) <= 10 && (float) $b <= 4294967294;
            if ($ai && $bi) return (int) $a <=> (int) $b;
            if ($ai !== $bi) return $ai ? -1 : 1;
            return strcmp(iconv('UTF-8', 'UTF-16BE', $a), iconv('UTF-8', 'UTF-16BE', $b));
        });
        $out = [];
        foreach ($items as $k => $value) $out[] = canonical((string) $k).':'.canonical($value);
        return '{'.implode(',', $out).'}';
    }
    if (is_array($v)) return '['.implode(',', array_map('canonical', $v)).']';
    if (is_int($v) || is_float($v)) {
        if (!is_finite((float) $v) || floor($v) != $v || abs($v) > 9007199254740991) throw new RuntimeException('number rejected');
        return (string) (int) $v;
    }
    return json_encode($v, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_LINE_TERMINATORS);
}

$checked = 0;
foreach (array_slice($argv, 1) as $path) {
    $fixture = json_decode((string) file_get_contents($path), false, 512, JSON_THROW_ON_ERROR);
    foreach ($fixture->cases as $case) {
        if (!isset($case->digest)) continue;
        $bytes = canonical($case->document);
        if ($bytes !== $case->canonical) throw new RuntimeException('canonical mismatch: '.$case->id);
        if ('sha256:'.hash('sha256', $bytes) !== $case->digest) throw new RuntimeException('digest mismatch: '.$case->id);
        foreach (($case->regions ?? []) as $region) {
            $node = null;
            $stack = [$case->document->root];
            while ($stack) {
                $current = array_pop($stack);
                if ($current->id === $region->node) { $node = $current; break; }
                foreach ((array) ($current->slots ?? new stdClass()) as $children) foreach ($children as $child) $stack[] = $child;
            }
            if ($node === null || 'sha256:'.hash('sha256', canonical($node)) !== $region->digest) throw new RuntimeException('region digest mismatch: '.$case->id.'/'.$region->node);
        }
        $checked++;
    }
}
echo json_encode(['status' => 'pass', 'documents' => $checked, 'notVerified' => ['PHP validation', 'PHP rendering']]), PHP_EOL;
