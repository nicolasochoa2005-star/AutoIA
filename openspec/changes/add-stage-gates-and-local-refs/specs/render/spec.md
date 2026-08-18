# Delta for render

## ADDED Requirements

### Requirement: Stills con Ken Burns
The system SHALL accept still images as visual inputs and convert them into 1080x1920 clips (Ken Burns zoom/pan) before concatenating with stock video.

#### Scenario: Beat still
- GIVEN a composed JPEG for a beat and valid audio duration
- WHEN render runs
- THEN the still is turned into a vertical clip used in the final MP4
