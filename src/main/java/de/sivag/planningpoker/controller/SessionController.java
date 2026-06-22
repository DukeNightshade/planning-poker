package de.sivag.planningpoker.controller;

import de.sivag.planningpoker.model.Session;
import de.sivag.planningpoker.model.enums.EstimationMethod;
import de.sivag.planningpoker.service.SessionService;
import de.sivag.planningpoker.service.TicketService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.Arrays;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Thymeleaf-Controller für die Seitennavigation.
 *
 * @author Nico Hoffmann
 * @version 1.0
 */
@Controller
@RequiredArgsConstructor
public class SessionController {

    // ====================================
    // Abhängigkeiten
    // ====================================

    private final SessionService sessionService;
    private final TicketService  ticketService;
    private final MessageSource  messageSource;

    // ====================================
    // View Endpunkte
    // ====================================

    @GetMapping("/")
    public String index(Model model, Locale locale) {
        model.addAttribute("methods", EstimationMethod.values());
        model.addAttribute("methodLabels", buildMethodLabels(locale));
        return "index";
    }

    @GetMapping("/session/{roomCode}")
    public String session(@PathVariable String roomCode, Model model, Locale locale) {
        Session session = sessionService.getSessionByRoomCode(roomCode);
        Map<String, String> methodLabels = buildMethodLabels(locale);
        model.addAttribute("session",          session);
        model.addAttribute("roomCode",         roomCode);
        model.addAttribute("estimationMethod", session.getEstimationMethod().name());
        model.addAttribute("participants",     sessionService.getParticipants(roomCode));
        model.addAttribute("showTopic",        session.isShowTopic());
        model.addAttribute("moderatorCanVote", session.isModeratorCanVote());
        model.addAttribute("autoReveal",       session.isAutoReveal());
        model.addAttribute("methodLabels",     methodLabels);
        model.addAttribute("hasTickets",       !ticketService.getTickets(roomCode).isEmpty());
        model.addAttribute("showOnlyTotal",     session.isShowOnlyTotal());
        model.addAttribute("currentMethodLabel", methodLabels.get(session.getEstimationMethod().name()));
        return "session";
    }

    // ====================================
    // Utility Methoden
    // ====================================

    private Map<String, String> buildMethodLabels(Locale locale) {
        return Arrays.stream(EstimationMethod.values())
                .collect(Collectors.toMap(
                        EstimationMethod::name,
                        m -> Objects.requireNonNullElse(
                                messageSource.getMessage(
                                        "method." + m.name().toLowerCase(),
                                        null,
                                        m.name(),
                                        locale),
                                m.name())
                ));
    }
}