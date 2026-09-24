<?php
/**
 * A deliberately small, dependency-free JSON Schema (draft 2020-12 subset)
 * validator, covering exactly the constructs used by
 * spec/plugin-spec.schema.json: type, required, properties,
 * additionalProperties, pattern, enum, items, minItems, maxItems,
 * uniqueItems, minLength, maxLength, format (uri only), if/then.
 *
 * This keeps `php tools/validate.php` runnable with zero Composer
 * dependencies beyond what a plain PHP 8.1 CLI already provides, which
 * matters because it is also used as the first step of tools/build.php.
 *
 * @package WpPluginFactory\Tools
 */

declare(strict_types=1);

namespace WpPluginFactory\Tools;

final class SchemaValidator {
    /** @var string[] */
    private array $errors = [];

    /**
     * @param mixed               $data
     * @param array<string,mixed> $schema
     *
     * @return string[] Validation error messages, empty when valid.
     */
    public function validate( mixed $data, array $schema ): array {
        $this->errors = [];
        $this->check($data, $schema, '$');

        return $this->errors;
    }

    /**
     * @param mixed               $data
     * @param array<string,mixed> $schema
     */
    private function check( mixed $data, array $schema, string $path ): void {
        if (isset($schema['type'])) {
            $this->checkType($data, (string) $schema['type'], $path);
        }

        if (isset($schema['enum']) && is_array($schema['enum']) && ! in_array($data, $schema['enum'], true)) {
            $this->errors[] = sprintf('%s: value must be one of [%s].', $path, implode(', ', array_map('strval', $schema['enum'])));
        }

        if (is_string($data)) {
            $this->checkString($data, $schema, $path);
        }

        if (is_array($data) && $this->isAssoc($data)) {
            $this->checkObject($data, $schema, $path);
        } elseif (is_array($data)) {
            $this->checkArray($data, $schema, $path);
        }

        if (isset($schema['if'], $schema['then']) && is_array($data)) {
            $ifErrorsBefore = $this->errors;
            $this->errors   = [];
            $this->check($data, $schema['if'], $path);
            $ifPassed     = [] === $this->errors;
            $this->errors = $ifErrorsBefore;

            if ($ifPassed) {
                $this->check($data, $schema['then'], $path);
            }
        }
    }

    private function checkType( mixed $data, string $type, string $path ): void {
        $ok = match ($type) {
            'object' => is_array($data) && ( $data === [] || $this->isAssoc($data) ),
            'array' => is_array($data) && ( $data === [] || ! $this->isAssoc($data) ),
            'string' => is_string($data),
            'number' => is_int($data) || is_float($data),
            'integer' => is_int($data),
            'boolean' => is_bool($data),
            'null' => null === $data,
            default => true,
        };

        if (! $ok) {
            $this->errors[] = sprintf('%s: expected type "%s", got "%s".', $path, $type, get_debug_type($data));
        }
    }

    /**
     * @param array<string,mixed> $schema
     */
    private function checkString( string $data, array $schema, string $path ): void {
        if (isset($schema['pattern']) && 1 !== preg_match('#' . str_replace('#', '\\#', (string) $schema['pattern']) . '#u', $data)) {
            $this->errors[] = sprintf('%s: "%s" does not match pattern /%s/.', $path, $data, $schema['pattern']);
        }

        if (isset($schema['minLength']) && strlen($data) < (int) $schema['minLength']) {
            $this->errors[] = sprintf('%s: must be at least %d characters.', $path, $schema['minLength']);
        }

        if (isset($schema['maxLength']) && strlen($data) > (int) $schema['maxLength']) {
            $this->errors[] = sprintf('%s: must be at most %d characters.', $path, $schema['maxLength']);
        }

        if (isset($schema['format']) && 'uri' === $schema['format'] && false === filter_var($data, FILTER_VALIDATE_URL)) {
            $this->errors[] = sprintf('%s: "%s" is not a valid URI.', $path, $data);
        }
    }

    /**
     * @param array<string,mixed> $data
     * @param array<string,mixed> $schema
     */
    private function checkObject( array $data, array $schema, string $path ): void {
        foreach ((array) ( $schema['required'] ?? [] ) as $requiredKey) {
            if (! array_key_exists($requiredKey, $data)) {
                $this->errors[] = sprintf('%s: missing required property "%s".', $path, $requiredKey);
            }
        }

        $properties = (array) ( $schema['properties'] ?? [] );

        if (array_key_exists('additionalProperties', $schema) && false === $schema['additionalProperties']) {
            foreach (array_keys($data) as $key) {
                if (! array_key_exists($key, $properties)) {
                    $this->errors[] = sprintf('%s: unexpected property "%s".', $path, $key);
                }
            }
        }

        foreach ($properties as $key => $propertySchema) {
            if (array_key_exists($key, $data) && is_array($propertySchema)) {
                $this->check($data[ $key ], $propertySchema, $path . '.' . $key);
            }
        }
    }

    /**
     * @param array<int,mixed>    $data
     * @param array<string,mixed> $schema
     */
    private function checkArray( array $data, array $schema, string $path ): void {
        if (isset($schema['minItems']) && count($data) < (int) $schema['minItems']) {
            $this->errors[] = sprintf('%s: must contain at least %d item(s).', $path, $schema['minItems']);
        }

        if (isset($schema['maxItems']) && count($data) > (int) $schema['maxItems']) {
            $this->errors[] = sprintf('%s: must contain at most %d item(s).', $path, $schema['maxItems']);
        }

        if (! empty($schema['uniqueItems'])) {
            $serialized = array_map(static fn ( $item ) => is_scalar($item) ? (string) $item : serialize($item), $data);

            if (count($serialized) !== count(array_unique($serialized))) {
                $this->errors[] = sprintf('%s: items must be unique.', $path);
            }
        }

        if (isset($schema['items']) && is_array($schema['items'])) {
            foreach ($data as $index => $item) {
                $this->check($item, $schema['items'], sprintf('%s[%d]', $path, $index));
            }
        }
    }

    /**
     * @param array<mixed> $data
     */
    private function isAssoc( array $data ): bool {
        if ([] === $data) {
            return false;
        }

        return array_keys($data) !== range(0, count($data) - 1);
    }
}
