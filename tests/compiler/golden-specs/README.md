# Golden Spec Freeze Set

Compiler regression suite — one spec per archetype. Each subdirectory contains a single OpenAPI spec chosen to represent that archetype.

| Archetype | Spec |
|-----------|------|
| simple_create | github/dededimos__bronze-assistant-alt__openapi |
| simple_list | api-guru/nic.at__domainfinder__1.1.0__openapi |
| list_detail | api-guru/va.gov__forms__0.0.0__openapi |
| list_create | github/alexhumphreys__openapi-rust-cli__openapi |
| full_crud | github/Tanmay18-12__SOA__product-service__openapi |
| enum_heavy | github/ratthapon__double-entry-api__exampleinput__openapi |
| array_of_objects | github/GLD-Privacy__reference-search-api__openapi |
| nested_depth_1 | api-guru/modelpubsub.com__0.1__openapi |
| nested_depth_2 | api-guru/googleapis.com__indexing__v3__openapi |
| map_schema | api-guru/exchangerate-api.com__4__openapi |
| multi_resource | github/GintarasP__secret_share_go__api__docs__openapi |
| large_resource | api-guru/interzoid.com__getzipinfo__1.0.0__openapi |
| optional_heavy | github/Pantheon-Industries__arxiv_gpt_docs__openapi |
| array_heavy | api-guru/amadeus.com__amadeus-flight-price-analysis__1.0.1__openapi |
| mixed_operations | github/redroostertech__Actions.txt__spec__openapi |
| deep_schema | api-guru/nytimes.com__article_search__1.0.0__openapi |
| many_enum_values | github/LruLab__minimum-wage-api__doc__openapi |
| nullable_fields | github/langgraphsystem__rssnews__api__search_openapi |
| large_api | github/jetmiky__partisipro__docs__api__openapi |
| mixed_schema_types | github/MargaritaAVT__restaurant-ordering-system__docs__api__openapi |
| array_root_list | github/nibzard__oas__oas-torture-suite__cases__11-refs__valid-all-local-refs__openapi |
| wrapped_list_response | github/GLD-Privacy__reference-search-api__openapi |

**Note:** `array_of_objects` and `wrapped_list_response` share the same spec (GLD-Privacy reference-search-api) — it demonstrates both traits. Total: 21 unique specs, 22 archetype slots.
