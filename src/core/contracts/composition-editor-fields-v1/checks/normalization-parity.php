<?php
// Cross-language probe: an independent PHP reading of the field-kind rules must
// reproduce every submission result and the canonical bytes of the applied node.
declare(strict_types=1);

function canonical(mixed $v): string {
    if ($v instanceof stdClass) {
        $items = get_object_vars($v);
        uksort($items, fn ($a, $b) => strcmp(iconv('UTF-8', 'UTF-16BE', (string) $a), iconv('UTF-8', 'UTF-16BE', (string) $b)));
        $out = [];
        foreach ($items as $k => $value) $out[] = canonical((string) $k).':'.canonical($value);
        return '{'.implode(',', $out).'}';
    }
    if (is_array($v)) return '['.implode(',', array_map('canonical', $v)).']';
    return json_encode($v, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_LINE_TERMINATORS);
}

function kind_of(stdClass $field, array $kinds): ?stdClass {
    $matches = array_values(array_filter($kinds, function ($kind) use ($field) {
        $identity = false;
        foreach ($kind->match->property as $p) if ($p->type === $field->property->type && $p->version === $field->property->version) $identity = true;
        $choices = isset($field->choices);
        return $identity && ($kind->match->choices === 'required' ? $choices : !$choices);
    }));
    return count($matches) === 1 ? $matches[0] : null;
}

function parse_submission(stdClass $field, ?string $raw, array $kinds): array {
    $kind = kind_of($field, $kinds);
    if ($kind === null) return ['error' => 'field_kind_unknown'];
    if ($kind->kind === 'toggle') {
        if ($raw !== null && $raw !== 'true') return ['error' => 'field_submission_invalid'];
        return $raw === 'true' ? ['value' => true] : ['unset' => true];
    }
    if ($raw === null || $raw === '') return ['unset' => true];
    $c = $field->constraints ?? new stdClass();
    if ($kind->kind === 'integer') {
        if (!preg_match('/^-?(?:0|[1-9][0-9]*)$/D', $raw)) return ['error' => 'field_value_type'];
        $value = (int) $raw;
        if ((isset($c->min) && $value < $c->min) || (isset($c->max) && $value > $c->max)) return ['error' => 'field_value_range'];
        return ['value' => $value];
    }
    if ($kind->kind === 'choice') return in_array($raw, $field->choices, true) ? ['value' => $raw] : ['error' => 'field_value_choice'];
    if (!mb_check_encoding($raw, 'UTF-8')) return ['error' => 'field_value_unicode'];
    if (preg_match('/[\x00-\x1f\x7f]/', $raw)) return ['error' => 'field_value_control'];
    $length = mb_strlen($raw, 'UTF-8');
    $min = max(1, $c->min_length ?? 1);
    $max = min(2000, $c->max_length ?? 2000);
    return ($length < $min || $length > $max) ? ['error' => 'field_value_length'] : ['value' => $raw];
}

[$script, $fixturePath, $kindsPath] = $argv;
$fixture = json_decode((string) file_get_contents($fixturePath), false, 512, JSON_THROW_ON_ERROR);
$kinds = json_decode((string) file_get_contents($kindsPath), false, 512, JSON_THROW_ON_ERROR)->entries;
$editor = json_decode((string) file_get_contents(dirname($kindsPath).'/composition-editor-manifests.v1.json'), false, 512, JSON_THROW_ON_ERROR)->entries;
$checked = 0;
foreach ($fixture->submissions as $case) {
    // A lone UTF-16 surrogate cannot be represented as a PHP UTF-8 request string.
    if ($case->id === 'text.lone-surrogate') continue;
    $field = null;
    foreach ($editor as $manifest) if ($manifest->type === $case->type) foreach ($manifest->fields as $f) if ($f->key === $case->field) $field = $f;
    $result = parse_submission($field, $case->raw, $kinds);
    if (canonical((object) $result) !== canonical($case->result)) throw new RuntimeException('result mismatch: '.$case->id);
    if (isset($case->applied)) {
        $node = json_decode(json_encode($case->node), false);
        $plane = $field->plane;
        $values = isset($node->$plane) ? (array) $node->$plane : [];
        if (isset($result['unset']) || ($result['value'] ?? null) === false) unset($values[$field->target]); else $values[$field->target] = $result['value'];
        if ($values) $node->$plane = (object) $values; else unset($node->$plane);
        if (canonical($node) !== canonical($case->applied)) throw new RuntimeException('applied mismatch: '.$case->id);
    }
    $checked++;
}
echo json_encode(['status' => 'pass', 'submissions' => $checked, 'skipped' => ['text.lone-surrogate: not representable as UTF-8 request data']]), PHP_EOL;
