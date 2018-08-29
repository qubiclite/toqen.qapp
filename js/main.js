window.onerror = function(err) {
    toastr.error(err);
};
const QLITE = new QliteExceptionWrapper(window.location.origin);
const QUBIC = "HOVTTAPGMQLVLUAZXGX9J9ABLPSY9SPSS9AOPCERFWPFIHBODMKWVAIDALPSZHIIZZ9TLPRNPDTXUT999";

let sender = null, sender_index = 0;
const inputs = [], outputs = [];

if(get_cookie("intro_read") !== "true")
    $('#intro_screen').removeClass('hidden');

show_accounts();

function create_account() {
    const $button = $('#button_create_account');
    action_start($button);
    QLITE.iam_create(function (res, err) {
        show_accounts();
        action_finish($button);
    });
}

function action_start($button) {
    $button.addClass("hidden");
    $('<img class="loading" src="imgs/loading.png" id="loading_'+$button.attr('id')+'" />').insertAfter($button);
}

function action_finish($button) {
    $button.removeClass("hidden");
    $('#loading_'+$button.attr('id')).remove();
}

function add_input(epoch) {

    if(inputs.length >= 5)
        return toastr.error("no more than 5 inputs allowed");

    const $button = $('#button_add_input');
    action_start($button);

    epoch = parseInt(epoch);
    QLITE.fetch_epoch(function (res, err) {

        action_finish($button);

        if(err) return;

        const fetch_result = res['fetched_epochs'][0]['result'];

        if(!fetch_result.startsWith("{"))
            return toastr.warning("epoch #" + epoch + " does not contain any transfers, it says: " + fetch_result);

        const value = find_input_value(parse_result_to_json(fetch_result)['transfers'], sender, sender_index);

        if(value === 0)
            return toastr.warning("you did not receive any funds in epoch #" + epoch);

        remove_input(epoch);
        inputs.push({
            'epoch': epoch,
            'value': value
        });

        display_inputs();

    }, QUBIC, parseInt(epoch));
}

function remove_input(epoch) {
    for(let i = 0; i < inputs.length; i++) {
        if(parseInt(inputs[i]['epoch']) === epoch)
            inputs.splice(i, 1);
    }
    display_inputs();
}

function add_output(receiver, index, value) {

    index = parseInt(index);
    value = parseInt(value);

    try {
        receiver = receiver.toUpperCase();
        _ParameterValidator.validate_tryte_sequence(receiver, 'receiver', 81, 81);
        _ParameterValidator.validate_integer(index, 'receiver index', 0, 2147483647);
        _ParameterValidator.validate_integer(value, 'value', 0, 2147483647);
    } catch (err) {
        toastr.error(err);
        return;
    }

    if(outputs.length >= 5)
        return toastr.error("no more than 5 outputs allowed");

    outputs.push({
        'receiver': receiver,
        'index': index,
        'value': value
    });
    display_outputs();
}

function display_inputs() {
    const $input_table = $('#input_table');
    var total_input_value = 0;

    $('.input_row').remove();

    inputs.forEach(function (element) {
        const $row = $("<tr>").addClass("input_row")
            .append($("<td>").text(element['epoch']))
            .append($("<td>").text(element['value']))
            .append($("<td>").append($("<input>")
                .attr("type", "button")
                .attr("value", "remove")
                .attr("onclick", "remove_input("+element['epoch']+");")));
        $input_table.append($row);
        total_input_value += element['value'];
    });

    $('#total_input_value').text(total_input_value);
}

function display_outputs() {
    const $output_table = $('#output_table');
    var total_output_value = 0;

    $('.output_row').remove();

    for(let i = 0; i < outputs.length; i++) {
        const element = outputs[i];
        const $row = $("<tr>").addClass("output_row")
            .append($("<td>").text(element['receiver']))
            .append($("<td>").text(element['index']))
            .append($("<td>").text(element['value']))
            .append($("<td>").append($("<input>")
                .attr("type", "button")
                .attr("value", "remove")
                .attr("onclick", "outputs.splice("+i+", 1);display_outputs();")));
        $output_table.append($row);
        total_output_value += element['value'];
    }

    $('#total_output_value').text(total_output_value);
}

function show_accounts() {
    const iams = $('#iams');

    $('.iam').remove();

    QLITE.iam_list(function (res, err) {

        if(err) return;

        res['list'].forEach(function (iam) {


            const icon = new Identicon(md5(iam), 128).toString();

            const $iam = $("<div>").addClass("iam")
                .append($("<div>").addClass("image").html('<img class="identicon" width=128 height=128 src="data:image/png;base64,' + icon + '"> '))
                .append($("<div>").addClass("id").text(iam))
                .append($("<input>")
                    .attr("type", "button")
                    .attr("value", "select")
                    .attr("onclick", "select_account('"+iam+"');"));
            iams.append($iam);
        });

        $('#loading_screen').addClass("hidden");
    })
}

function select_account(iam) {
    $('#account_page').addClass("hidden");
    $('#account_index_page').removeClass("hidden");
    if(iam === sender) return;
    sender = iam;

    const icon = new Identicon(md5(iam), 60).toString();
    $('#account').html('<p>'+iam+'<label id="index"></label></p><img class="identicon" width=60 height=60 src="data:image/png;base64,' + icon + '"> ');

    $('#explorer_link_without_index').attr("href", "https://qubiota.com/toqen?account="+sender);
}

function select_account_index(index) {

    $('#loading_screen').removeClass("hidden");
    QLITE.qubic_consensus(function (res, err) {
        if(res && res['result']) {
            $('#loading_screen').addClass("hidden");
            return toastr.error("this index has already been used");
        }

        QLITE.iam_read(function (res, err) {

            $('#loading_screen').addClass("hidden");

            if(res && res['read']) {
                toastr.warning("you already sent a transfer from this index, promoting it again ...");
                promote_transfer(sender, index);
                return;
            }

            $('#account_index_page').addClass("hidden");
            $('#transfer_page').removeClass("hidden");
            sender_index = index;
            $('#explorer_link').attr("href", "https://qubiota.com/toqen?account="+sender+"&account_index="+sender_index);
            $('#account #index').text("/"+index);

        }, sender, index);
    }, QUBIC, sender.substr(0, 30), index);
}

function parse_result_to_json(result) {
    return JSON.parse(result.replace(new RegExp("'", 'g'), "\""));
}

function find_input_value(transfers, receiver, receiver_index) {
    var sum = 0;
    transfers.forEach(function (element) {
        if(element['receiver'] === receiver && element['index'] === receiver_index)
            sum += element['value'];
    });
    return sum;
}

function send_transfer() {

    if($('#total_output_value').text() !== $('#total_input_value').text()) {
        toastr.error("total input and output value need to match");
        return;
    }

    if($('#total_output_value').text() === "0") {
        toastr.error("transfer value is required to be greater than 0");
        return;
    }

    if(outputs.length > 5 || inputs.length > 5) {
        toastr.error("no more than 5 inputs and 5 outputs allowed");
        return;
    }

    const input_epochs = inputs.slice();
    input_epochs.forEach(function (element) {
        delete element["value"];
    });

    const request = {
        "inputs": inputs,
        "outputs": outputs
    };

    QLITE.iam_read(function (res, err) {

        if(res && res['read']) {
            toastr.warning("you already sent a transfer from this index, promoting it again ...");
            promote_transfer(sender, sender_index);
            return;
        }

        QLITE.iam_write(function (res, err) {
            if(err) return;
            toastr.success("transfer sent, promoting ...");
            promote_transfer(sender, sender_index);
        }, sender, sender_index, request);

    }, sender, sender_index);
}

function promote_transfer(sender, sender_index) {
    const promotion_message = {"sender": sender, "index": sender_index};

    $('#loading_screen').removeClass("hidden");

    QLITE.qubic_consensus(function (res, err) {
        if(res && res['result']) {
            $('#loading_screen').addClass("hidden");
            return toastr.error("a transfer sent from this address has already confirmed, please select another index");
        }

        QLITE.import(function (res, err) {
            QLITE.iam_write(function (res, err) {
                $('#loading_screen').addClass("hidden");
                if(err) return;
                QLITE.iam_delete(function (res, err) { }, "AOKR9YPJWBOMNZERYMBLSBZUFOBLMA9LFVGFNQBFGRZWECFJSJICEUELNMLXSYAFMYWOG9FTND9VHT999");
                toastr.success("transfer promoted");
            }, "AOKR9YPJWBOMNZERYMBLSBZUFOBLMA9LFVGFNQBFGRZWECFJSJICEUELNMLXSYAFMYWOG9FTND9VHT999", 0, promotion_message);
        }, "i_AOKR9YPJWBOMNZERYMBLSBZUFOBLMA9LFVGFNQBFGRZWECFJSJICEUELNMLXSYAFMYWOG9FTND9VHT999_GUACEZHVFAEZEYGUACEZGQFEFFGOAGHSDAHCFCEZGUACEZGDFAABABEYEVJVIDABGBJLFQGNICDRHUBCGSEEDWDZEOFPCDICHGEHHOEYCPGCHJAACCIBGKIZHPINHKGGIBETIJHHANIIESCLCRENCGGUEOCXBBIFJCDJABHFAAGBGYJFEKIWIQCDJBAZIABLBKBFBFEAFCJRFOGGCOHZCHBPDJEWCDCSFZEQHFIHDZCSBOBMFTFNFCETADEODFCRGCCPFAGZIEFRIKFUARGWEOJLELBUGPIRDJGOEHEKGGFBFXBDDDHSEZCTFAFTEYAXIQIAAPFTGHFJCYBYASCFACBIEDAEFJEIIIGAENFAABABEYEPDTBGAFDIBBHHDQCXCIBRIMHACEIHCFJPAUBVCHESHEECACERIHHWFJHHFFACIXIBIJIHAOCGDGIJHZDYJHFFFOABAACAHTFUJHGHEAHWGMFUFRCDDBFHGWAMCUBMDTHGFUJQALIEJSANGMDSBJBUGCGPBZBMJLARJEBJJVFJESGFGZISEJETISJQEZGIHFCYBKEJCKBOIBAQAJBOADDRDTIKDXBFFEASALIWIOAAJRIFGJIUEZHWHFEWDBHTGOFCFUFAFSHSARGICQJPCZJKFNELFDFIFMBFDHJCICIWHVGWHY");
    }, QUBIC, sender.substr(0, 30), sender_index);
}

function hide_intro() {
    document.cookie = "intro_read=true;";
    $('#intro_screen').addClass('hidden');
}

// credits to https://stackoverflow.com/a/15724300 (modified)
function get_cookie(name) {
    var value = "; " + document.cookie;
    var parts = value.split("; " + name + "=");
    if (parts.length == 2) return parts.pop().split(";").shift();
    return null;
}