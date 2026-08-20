import { Job } from 'bullmq';
import { PublishConflictError } from '../db/video-review.errors';
import { PublishProducerService } from './publish-producer.service';
import { PublishProcessor } from './publish.processor';
import { VideoPublishJobData } from './publish.queue';
import { PublishService } from './publish.service';

describe('PublishProcessor', () => {
  const publish = { publish: jest.fn() };
  const producer = { enqueue: jest.fn() };
  const processor = new PublishProcessor(
    publish as unknown as PublishService,
    producer as unknown as PublishProducerService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('re-enqueues with delay on quotaExceeded and does not throw', async () => {
    const retryAt = new Date(Date.now() + 3_600_000);
    publish.publish.mockResolvedValue({ kind: 'quota-exceeded', retryAt });

    await processor.process({ id: '1', data: { videoId: 'v1' } } as Job<VideoPublishJobData>);

    expect(producer.enqueue).toHaveBeenCalledWith('v1', expect.any(Number));
    const delay = producer.enqueue.mock.calls[0][1] as number;
    expect(delay).toBeGreaterThanOrEqual(60_000);
  });

  it('does not upload when publish refuses a non-approved video', async () => {
    publish.publish.mockRejectedValue(new PublishConflictError('Video is REJECTED, expected APPROVED'));
    await expect(
      processor.process({ id: '1', data: { videoId: 'v1' } } as Job<VideoPublishJobData>),
    ).resolves.toBeUndefined();
    expect(producer.enqueue).not.toHaveBeenCalled();
  });
});
