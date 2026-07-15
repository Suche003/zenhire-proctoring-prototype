import type { ProctoringEvent } from '../types/proctoring'

type EventLogProps = {
  events: ProctoringEvent[]
}

const formatEventTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))

function EventLog({ events }: EventLogProps) {
  return (
    <section className="event-log" aria-labelledby="event-log-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Audit trail</p>
          <h2 id="event-log-title">Proctoring Activity</h2>
        </div>
        <span className="count-badge">{events.length}</span>
      </div>

      {events.length === 0 ? (
        <p className="empty-log">No proctoring events recorded.</p>
      ) : (
        <ol className="event-list">
          {events.map((event) => (
            <li className="event-item" key={event.id}>
              <div className="event-row">
                <strong>{event.label}</strong>
                <div className="event-meta">
                  <span className={`severity-badge severity-badge--${event.severity}`}>
                    {event.severity}
                  </span>
                  <time dateTime={event.occurredAt}>
                    {formatEventTime(event.occurredAt)}
                  </time>
                </div>
              </div>
              <p>{event.message}</p>
              {event.details ? <small>{event.details}</small> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export default EventLog
