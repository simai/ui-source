<?php
// Conformance probe for fixed vectors only; not a product adapter or Recipe resolver.
function canonical(mixed $v): string {
    if ($v instanceof stdClass) {
        $items = get_object_vars($v);
        uksort($items, function($a,$b) {
            $a=(string)$a;$b=(string)$b;
            $ai=preg_match('/^(0|[1-9][0-9]*)$/D',$a) && strlen($a)<=10 && (float)$a<=4294967294;
            $bi=preg_match('/^(0|[1-9][0-9]*)$/D',$b) && strlen($b)<=10 && (float)$b<=4294967294;
            if($ai && $bi) return (int)$a <=> (int)$b;
            if($ai !== $bi) return $ai ? -1 : 1;
            return strcmp(iconv('UTF-8','UTF-16BE',$a),iconv('UTF-8','UTF-16BE',$b));
        });
        $out=[];foreach($items as $k=>$value) $out[]=canonical((string)$k).':'.canonical($value);
        return '{'.implode(',',$out).'}';
    }
    if (is_array($v)) return '['.implode(',',array_map('canonical',$v)).']';
    if (is_int($v) || is_float($v)) {
        if (!is_finite((float)$v) || floor($v)!=$v || abs($v)>9007199254740991) throw new RuntimeException('number rejected');
        return (string)(int)$v;
    }
    return json_encode($v, JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_LINE_TERMINATORS);
}
$f=json_decode(file_get_contents($argv[1]),false,512,JSON_THROW_ON_ERROR);
foreach($f->positive as $v) {
    $s=canonical($v->value);
    if ($s!==$v->canonical || bin2hex($s)!==$v->utf8Hex || 'sha256:'.hash('sha256',$s)!==$v->digest) throw new RuntimeException('vector '.$v->id);
}
$corpus=json_decode(file_get_contents($argv[2]),false,512,JSON_THROW_ON_ERROR);
$ids=$corpus->identityVectors;
foreach($ids as $v) {
    $s=canonical(['sf-composition-node-v1',$v->recipeId,$v->segments]);
    if ('n-'.hash('sha256',$s)!==$v->expectedId) throw new RuntimeException('identity mismatch');
}
foreach(['0.5','9007199254740992','"\\ud800"','NaN','Infinity'] as $bad) {
    $rejected=false;try {canonical(json_decode($bad,false,512,JSON_THROW_ON_ERROR));} catch(Throwable $e) {$rejected=true;}
    if (!$rejected) throw new RuntimeException('invalid accepted');
}
// Recipe and Document digests of the corpus: the older form gives the bytes
// 1.0.1 fixes; with fixtures/format-names.json (third argument) the same
// values named without a version give the digests 1.1.0 records.
$digest=fn($v)=>'sha256:'.hash('sha256',canonical($v));
$named=function(stdClass $v,string $name):stdClass {$c=clone $v;$c->schema=$name;$c->schema_version=1;return $c;};
$documents=0;
foreach(['compact','expanded'] as $mode) {
    $e=$corpus->expected->$mode;
    if ($digest($corpus->recipe)!==$e->dependencyReceipt->recipeDigest) throw new RuntimeException('recipe digest '.$mode);
    if ($digest($corpus->sources->article)!==$e->dependencyReceipt->references[0]->digest) throw new RuntimeException('template digest '.$mode);
    if ($digest($e->document)!==$e->dependencyReceipt->documentDigest) throw new RuntimeException('document digest '.$mode);
    $documents++;
    if (isset($argv[3])) {
        $bare=json_decode(file_get_contents($argv[3]),false,512,JSON_THROW_ON_ERROR)->bareResolution->$mode;
        if ($digest($named($corpus->recipe,'simai.composition.recipe'))!==$bare->recipeDigest) throw new RuntimeException('bare recipe digest '.$mode);
        if ($digest($named($e->document,'simai.composition.document'))!==$bare->documentDigest) throw new RuntimeException('bare document digest '.$mode);
        if ($digest($named($corpus->sources->article,'simai.composition.recipe-manifest'))!==$bare->references[0]->digest) throw new RuntimeException('bare template digest '.$mode);
        $documents++;
    }
}
echo json_encode(['status'=>'pass','canonicalVectors'=>count($f->positive),'identityVectors'=>count($ids),'rejectedInputs'=>5,'documentDigests'=>$documents,'notVerified'=>['duplicate-key detection by a production PHP decoder','PHP Recipe resolution']]);
