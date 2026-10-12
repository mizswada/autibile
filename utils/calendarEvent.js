import { getAppointmentStatus } from './appointmentStatus';
import { getBillingStateMeta } from './billingState';

/**
 * Draws one appointment on the FullCalendar grid (eventContent).
 *
 *  - Month grid (and its "+N more" popover): ONE compact line, so a busy day stays short:
 *      [A] 11:00 AM  Nur Alia binti ...  ✓ $
 *    The event keeps its status colour (the event is a coloured block, see eventDisplay in
 *    the page). The popover additionally shows a second line with the time range, service
 *    and practitioner (styled in _fullcalendar.scss).
 *  - Week / list: full details with a visible status chip.
 *
 * Names come from user input, so everything is set with textContent.
 */

/**
 * Short clock for the crowded month cells: "11:00" -> "11am", "13:30" -> "1:30pm".
 * Returns '' when the value is not HH:mm. (The full range is in the popover and tooltip.)
 */
export function formatClock(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
  if (!match) return '';
  const hours = parseInt(match[1], 10);
  const suffix = hours >= 12 ? 'pm' : 'am';
  const hour12 = hours % 12 || 12;
  return match[2] === '00' ? `${hour12}${suffix}` : `${hour12}:${match[2]}${suffix}`;
}

function make(tag, classes = [], text = '') {
  const el = document.createElement(tag);
  if (classes.length) el.classList.add(...classes);
  if (text) el.textContent = text;
  return el;
}

/**
 * @param arg FullCalendar eventContent argument
 * @param options.showBilling  true for administrators (billing labels are admin-only)
 * @param options.timeRangeText  (time_slot) => "11:00 AM - 12:00 PM"
 */
export function buildAppointmentEventContent(arg, { showBilling = false, timeRangeText = (v) => v } = {}) {
  const props = arg.event.extendedProps;
  const status = getAppointmentStatus(props.status);
  const isAdminAppointment = !props.practitioner_id || props.practitioner_id === 'admin';
  const timeRange = timeRangeText(props.time_slot) || 'Unknown Time';
  const startClock = formatClock(props.start_time) || timeRange;
  const patientName = props.patient_name || 'Unknown Patient';
  const serviceName = props.service_name || 'Unknown Service';
  const practitionerName = isAdminAppointment ? 'Admin' : (props.practitioner_name || 'Unknown Practitioner');
  const billing = showBilling ? getBillingStateMeta(props.billing_state) : null;

  const eventEl = make('div', ['fc-event-custom-content']);
  eventEl.title = [
    `${patientName} - ${status.label}`,
    timeRange,
    serviceName,
    isAdminAppointment ? 'Admin (no practitioner assigned yet)' : practitionerName,
    `Session ${props.session_number ?? '-'}`,
    billing ? `Billing: ${billing.label}` : '',
  ].filter(Boolean).join('\n');

  // ---- Month grid + "+N more" popover: one compact line ----
  if (arg.view.type === 'dayGridMonth') {
    eventEl.classList.add('fc-event-compact');

    const line = make('span', ['fc-event-compact__line']);
    if (isAdminAppointment) {
      line.appendChild(make('span', ['fc-event-admin-badge'], 'A'));
    }
    line.appendChild(make('span', ['fc-event-compact__time'], startClock));
    line.appendChild(make('span', ['fc-event-compact__name'], patientName));

    // Marks on the right: ✓ completed, ✕ cancelled, $ still to be billed / paid.
    const marks = make('span', ['fc-event-compact__marks']);
    if (status.symbol === '✓' || status.symbol === '✕') {
      marks.appendChild(make('span', ['fc-event-mark'], status.symbol));
    }
    if (billing && (props.billing_state === 'unbilled' || props.billing_state === 'billed_unpaid')) {
      marks.appendChild(make('span', ['fc-event-mark', 'fc-event-mark--billing'], billing.symbol));
    }
    if (marks.childNodes.length) line.appendChild(marks);
    eventEl.appendChild(line);

    // Only visible inside the popover (CSS), where there is room for it.
    eventEl.appendChild(
      make('span', ['fc-event-compact__detail'], `${timeRange} · ${serviceName} · ${practitionerName}`),
    );

    return { domNodes: [eventEl] };
  }

  // ---- Week / list: full details with a visible status chip ----
  eventEl.style.padding = '2px';
  eventEl.style.overflow = 'hidden';

  const headerEl = make('div', ['flex', 'items-center', 'gap-2', 'mt-1']);
  headerEl.appendChild(make('span', ['fc-event-status-chip'], status.label));
  if (billing) {
    headerEl.appendChild(make('span', ['fc-event-status-chip'], `$ ${billing.label}`));
  }
  headerEl.appendChild(make('span', ['text-xs', 'opacity-90'], timeRange));
  eventEl.appendChild(headerEl);

  eventEl.appendChild(make('div', ['font-medium'], patientName));
  eventEl.appendChild(make('div', ['text-xs', 'opacity-80'], serviceName));

  const practitionerEl = make('div', ['text-xs', 'font-semibold'], practitionerName);
  if (isAdminAppointment) {
    practitionerEl.style.display = 'inline-block';
    practitionerEl.style.border = '1px solid #ea580c';
    practitionerEl.style.borderRadius = '4px';
    practitionerEl.style.padding = '1px 4px';
    practitionerEl.style.backgroundColor = '#fed7aa';
    practitionerEl.style.color = '#ea580c';
  }
  eventEl.appendChild(practitionerEl);

  eventEl.appendChild(make('div', ['text-xs', 'font-semibold'], `Session ${props.session_number ?? '-'}`));

  return { domNodes: [eventEl] };
}
