package de.sivag.planningpoker.controller;

import de.sivag.planningpoker.model.Session;
import de.sivag.planningpoker.model.enums.EstimationMethod;
import de.sivag.planningpoker.service.SessionService;
import de.sivag.planningpoker.service.TicketService;
import de.sivag.planningpoker.utility.StringUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
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
        return renderSession(sessionService.getSessionByRoomCode(roomCode), model, locale);
    }

    /** Permanenter Team-Raum über seinen lesbaren Namen. */
    @GetMapping("/team/{teamName}")
    public String team(@PathVariable String teamName, Model model, Locale locale) {
        return renderSession(sessionService.getSessionByTeamName(teamName), model, locale);
    }

    /**
     * Eingabe aus "Beitreten" auf der Startseite: Team-Name oder Raumcode.
     * Team-Namen haben Vorrang, unbekannte Eingaben führen zurück zur Startseite.
     */
    @GetMapping("/join/{query}")
    public String join(@PathVariable String query) {
        String input = query.trim();
        try {
            String teamName = StringUtils.sanitizeTeamName(input);
            if (sessionService.teamRoomExists(teamName)) {
                return "redirect:/team/" + teamName;
            }
        } catch (IllegalArgumentException e) {
            // kein gültiger Team-Name, evtl. ein Raumcode
        }
        String roomCode = input.toUpperCase(Locale.ROOT);
        if (sessionService.sessionExists(roomCode)) {
            return "redirect:/session/" + roomCode;
        }
        return "redirect:/?notfound=" + URLEncoder.encode(input, StandardCharsets.UTF_8);
    }

    private String renderSession(Session session, Model model, Locale locale) {
        String roomCode = session.getRoomCode();
        Map<String, String> methodLabels = buildMethodLabels(locale);
        model.addAttribute("session",          session);
        model.addAttribute("roomCode",         roomCode);
        model.addAttribute("teamName",         session.getTeamName());
        model.addAttribute("estimationMethod", session.getEstimationMethod().name());
        model.addAttribute("cards",            session.getEstimationMethod().getCards());
        model.addAttribute("participants",     sessionService.getParticipants(roomCode));
        model.addAttribute("showTopic",        session.isShowTopic());
        model.addAttribute("productOwnerCanVote", session.isProductOwnerCanVote());
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