# Invalid OpenAPI Specs

Specs that **intentionally fail** validation. Used for compiler correctness and regression tests.

- **`golden_openapi_invalid_expected_failure`** — Multiple tags, multiple success responses, multiple path params, oneOf
- **`golden_openapi_invalid_mixed_grouping_expected_failure`** — Mixed tag/path grouping
- **`golden_openapi_invalid_non_crud_expected_failure`** — Non-CRUD operation (POST without body)

**Eval:** Use `npm run eval:ai -- --dir invalid` to test that these specs fail predictably (0/5 valid runs expected).
