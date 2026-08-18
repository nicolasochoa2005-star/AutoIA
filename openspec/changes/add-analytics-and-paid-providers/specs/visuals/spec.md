# Delta for visuals

## ADDED Requirements

### Requirement: GenAI opt-in por beat
The system SHALL use paid visual generation only when a beat explicitly selects a paid provider. Other beats keep Pexels or local refs.

#### Scenario: Solo beats de personaje
- GIVEN a graph where character beats use a paid provider and background beats use Pexels
- WHEN the run executes
- THEN paid visual APIs are called only for the character beats
- AND Pexels or local files still supply the backgrounds
